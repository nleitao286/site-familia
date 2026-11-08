// Persistência de rascunhos por utilizador e por página; nunca contém tokens.
export const TOPICS = { 'familia-menu-v3': 'refeicoes', 'familia-viaturas-v1': 'viaturas', 'familia-compras-v1': 'compras', 'familia-compromissos-v1': 'compromissos' };
export const clone = value => JSON.parse(JSON.stringify(value));
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  return value;
}
export const same = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
export function validate(topic, data) {
  if (!Object.values(TOPICS).includes(topic)) throw Error('Tema inválido.');
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const valid = topic === 'refeicoes' ? object(data) && object(data.weeks) && object(data.dishes) && Array.isArray(data.dishes.A) && Array.isArray(data.dishes.J) : Array.isArray(data);
  if (!valid || JSON.stringify(data).length > 2000000) throw Error('Formato dos dados inválido ou demasiado grande.');
  return clone(data);
}
const keyFor = topic => Object.keys(TOPICS).find(key => TOPICS[key] === topic);
function legacyMeals(raw) {
  const old=JSON.parse(raw);if(!old?.sel||typeof old.sel!=='object')throw Error('Cópia antiga inválida.');
  const start=/^\d{4}-\d\d-\d\d$/.test(old.inicio||'')?new Date(old.inicio+'T12:00:00'):new Date();
  start.setDate(start.getDate()-(start.getDay()+1)%7);
  const date=[start.getFullYear(),String(start.getMonth()+1).padStart(2,'0'),String(start.getDate()).padStart(2,'0')].join('-');
  const week={};for(let i=0;i<7;i++)week[i]={A:{dish:String(old.sel[i+'A']||''),salad:!!old.sel[i+'AS']},J:{dish:String(old.sel[i+'J']||''),salad:!!old.sel[i+'JS']}};
  return {weeks:{[date]:week},dishes:{A:(old.ideas?.A||[]).filter(x=>typeof x==='string'),J:(old.ideas?.J||[]).filter(x=>typeof x==='string')}};
}
export class FamilyStore {
  constructor({ client, storage, userId, notify = () => {}, id = () => crypto.randomUUID() }) {
    this.client = client; this.storage = storage; this.userId = userId; this.id = id;
    this.prefix = `familia-supabase-v1:${userId}:`; this.instance = id();
    this.records = {}; this.notify = notify; this.active = true; this.saving = {};
  }
  keys() { return Array.from({ length: this.storage.length }, (_, i) => this.storage.key(i)).filter(key => key?.startsWith(this.prefix)); }
  key(topic) { return `${this.prefix}${topic}:${this.instance}`; }
  decode(key) {
    const raw = this.storage.getItem(key);
    try { return raw ? JSON.parse(raw) : null; } catch { throw Error('Existe uma cópia local ilegível. Descarrega uma cópia antes de continuar.'); }
  }
  journals(topic) {
    const entries = this.keys().filter(key => key.startsWith(this.prefix + topic + ':')).map(key => ({ key, value: this.decode(key) }));
    const resolved = new Set(entries.filter(x => x.value?.format === 'family-receipt').flatMap(x => x.value.refs.map(ref => ref.key + ':' + ref.revision)));
    return entries.filter(x => x.value?.format === 'family-draft' && x.value.dirty && !resolved.has(x.key + ':' + x.value.revision));
  }
  persist(topic) {
    const record = this.records[topic];
    record.revision = this.id(); record.at = new Date().toISOString();
    try { this.storage.setItem(this.key(topic), JSON.stringify({ ...record, format: 'family-draft' })); record.storageError = ''; return true; }
    catch { record.storageError = 'Sem espaço ou permissão para guardar a cópia local. Descarrega uma cópia antes de sair.'; return false; }
  }
  receipt(topic, refs) {
    if (!refs.length) return;
    this.storage.setItem(`${this.prefix}${topic}:resolved:${this.id()}`, JSON.stringify({ format: 'family-receipt', refs, at: new Date().toISOString() }));
  }
  async remote(topic) {
    if (!this.active) throw Error('A sessão terminou.');
    const { data, error } = await this.client.from('familia_dados').select('tema,conteudo,versao').eq('tema', topic).single();
    if (error || !data) throw Error('Não foi possível ler os dados partilhados. Verifica a sessão e a ligação.');
    if (!Number.isSafeInteger(Number(data.versao)) || Number(data.versao) < 1) throw Error('Versão remota inválida.');
    return { data: validate(topic, data.conteudo), version: Number(data.versao) };
  }
  history(record, reason) {
    return [{ data: clone(record.data), version: record.version, at: new Date().toISOString(), reason }, ...(record.history || [])].slice(0, 10);
  }
  legacy(topic) {
    let key = keyFor(topic), raw = this.storage.getItem(key);
    if (!raw && topic==='refeicoes') {key='menu-semana';raw=this.storage.getItem(key);if(raw){try{return {key,raw,data:legacyMeals(raw)}}catch{return {key,raw,invalid:true}}}}
    if (!raw) return null;
    try {
      const data = validate(topic, JSON.parse(raw));
      const dirty = JSON.parse(this.storage.getItem('familia-gh-dirty-v1') || '{}')[topic];
      const previous = JSON.parse(this.storage.getItem('familia-gh-snapshot-v1') || '{}')[topic];
      if (!dirty && previous && same(data, JSON.parse(previous))) return null;
      return { key, raw, data };
    } catch { return { key, raw, invalid: true }; }
  }
  async load(topic) {
    const remote = await this.remote(topic);
    const journals = this.journals(topic);
    for (const { value } of journals) {validate(topic, value.data);validate(topic,value.base);if(!Number.isSafeInteger(value.version)||value.version<1)throw Error("Versão da cópia local inválida. Descarrega-a antes de continuar.");}
    const acknowledged = journals.filter(x => same(x.value.data, remote.data));
    this.receipt(topic, acknowledged.map(x => ({ key: x.key, revision: x.value.revision })));
    const pending = journals.filter(x => !same(x.value.data, remote.data)).sort((a, b) => String(b.value.at).localeCompare(String(a.value.at)));
    const latest = pending[0]?.value;
    const divergent = pending.some(x => !same(x.value.data, latest.data));
    const legacy = this.legacy(topic);
    const decision = this.storage.getItem(`${this.prefix}${topic}:legacy-decision`);
    const record = this.records[topic] = {
      data: latest ? clone(latest.data) : remote.data, version: latest ? latest.version : remote.version,
      base: latest ? clone(latest.base) : clone(remote.data), remote, dirty: !!latest,
      conflict: !!latest && (latest.conflict || latest.version !== remote.version || divergent),
      sources: pending.map(x => ({ key: x.key, revision: x.value.revision })),
      candidates: pending.map(x => ({ data: clone(x.value.data), at: x.value.at })), history: latest?.history || [],
      legacy: legacy && legacy.raw !== decision && (legacy.invalid || !same(legacy.data, remote.data)) ? legacy : null,
      error: '', storageError: ''
    };
    if (latest) this.persist(topic);
    this.notify(); return record;
  }
  get(key, fallback) { const record = this.records[TOPICS[key]]; return record ? clone(record.data) : fallback; }
  changed(key, data) {
    if (!this.active) return false;
    const topic = TOPICS[key], record = this.records[topic];
    if (!record) throw Error('Dados ainda não carregados.');
    const next = validate(topic, data);
    record.history = this.history(record, 'Antes de alterar neste navegador'); record.data = next;
    record.dirty = true; record.error = '';
    const ok = this.persist(topic); this.notify(); return ok;
  }
  async refresh(topic) {
    const record = this.records[topic], remote = await this.remote(topic);
    if (!this.active) return;
    record.remote = remote;
    if (record.dirty && (record.conflict || !same(record.data, remote.data))) {
      if (record.version !== remote.version) record.conflict = true;
    } else {
      if (record.dirty) this.receipt(topic, record.sources);
      record.history = this.history(record, 'Antes de atualizar dados partilhados');
      Object.assign(record, { data: remote.data, base: clone(remote.data), version: remote.version, dirty: false, conflict: false, sources: [], error: '' });
    }
    this.persist(topic); this.notify();
  }
  async save(topic) {
    const record = this.records[topic];
    if (!this.active || this.saving[topic] || !record?.dirty || record.conflict || record.storageError) return false;
    this.saving[topic] = true; record.error = ''; this.notify();
    const sent = clone(record.data), version = record.version, refs = [...record.sources, { key: this.key(topic), revision: record.revision }];
    try {
      const { data, error } = await this.client.rpc('guardar_familia_dados', { p_tema: topic, p_conteudo: sent, p_versao: version });
      if (error) throw Error('Sem confirmação de gravação. A cópia local foi mantida; verifica a ligação e atualiza antes de repetir.');
      if (!Array.isArray(data) || data.length !== 1 || Number(data[0].nova_versao) !== version + 1) {
        record.conflict = true; record.error = 'Outra sessão pode ter alterado os dados. Compara as versões antes de guardar.';
        try { record.remote = await this.remote(topic); } catch {}
        this.persist(topic); return false;
      }
      Object.assign(record, { version: version + 1, base: sent, remote: { data: sent, version: version + 1 }, dirty: !same(record.data, sent), conflict: false, sources: [], lastSavedAt:new Date().toISOString() });
      // As outras páginas mantêm os seus próprios ficheiros de rascunho. Só se
      // regista a versão exata conciliada; nunca se apagam rascunhos de outro separador.
      let receiptError='';
      try { this.receipt(topic, refs); } catch { receiptError = 'Gravado no Supabase, mas faltou registar a conciliação local. Mantém uma cópia.'; }
      this.persist(topic);if(receiptError)record.storageError=receiptError;return true;
    } catch (error) { record.error = error.message; this.persist(topic); return false; }
    finally { delete this.saving[topic]; this.notify(); }
  }
  async acceptRemote(topic) {
    const record = this.records[topic], remote = await this.remote(topic);
    const before = clone(record);
    const refs = [...record.sources, { key: this.key(topic), revision: record.revision }].filter(ref => ref.revision);
    record.history = this.history(record, 'Cópia antes de escolher os dados partilhados');
    Object.assign(record, { data: remote.data, base: clone(remote.data), remote, version: remote.version, dirty: false, conflict: false, error: '', sources: [] });
    if (!this.persist(topic)) { this.records[topic] = before; this.notify(); throw Error('Não foi possível conservar a cópia local. Descarrega-a antes de substituir.'); }
    this.receipt(topic, refs);
    if (record.legacy) {
      this.storage.setItem(`${this.prefix}${topic}:legacy-decision`, record.legacy.raw);
      record.legacy = null; this.persist(topic);
    }
    this.notify();
  }
  async resolve(topic, data, expectedVersion) {
    const record = this.records[topic], merged = validate(topic, data), remote = await this.remote(topic);
    if (remote.version !== expectedVersion) { record.remote = remote; record.conflict = true; this.notify(); throw Error('Os dados partilhados mudaram. Revê a nova versão antes de conciliar.'); }
    record.history = this.history(record, 'Antes de conciliar versões');
    Object.assign(record, { data: merged, base: clone(remote.data), remote, version: remote.version, dirty: true, conflict: false, error: '' });
    if (!this.persist(topic)) throw Error(record.storageError);
    if (record.legacy) { this.storage.setItem(`${this.prefix}${topic}:legacy-decision`, record.legacy.raw); record.legacy = null; this.persist(topic); }
    this.notify();
  }
  restore(topic, data) {
    const record = this.records[topic];
    record.history = this.history(record, 'Antes de recuperar uma cópia');
    Object.assign(record, { data: validate(topic, data), dirty: true, conflict: true, error: 'Cópia recuperada. Compara com os dados partilhados antes de guardar.' });
    if (!this.persist(topic)) throw Error(record.storageError);
    this.notify();
  }
  importPack(pack) {
    if(pack?.format!=='familia-supabase-recovery'||pack.version!==1||!pack.topics)throw Error('Cópia de recuperação inválida.');
    const chosen={},archives=[];
    for(const [topic,record] of Object.entries(pack.topics)){if(!this.records[topic])throw Error('Abre a página inicial para importar estes temas.');chosen[topic]=validate(topic,record.data);}
    for(const [source,raw] of Object.entries(pack.journals||{})){
      let record;try{record=JSON.parse(raw)}catch{throw Error('Um rascunho importado está ilegível. O ficheiro original foi mantido.');}
      if(record.format!=='family-draft')continue;
      const topic=Object.values(TOPICS).find(topic=>source.includes(':'+topic+':'));if(!topic)continue;
      const data=validate(topic,record.data);const history=(record.history||[]).map(version=>({...version,data:validate(topic,version.data)}));
      archives.push({topic,data,history,version:Number(record.version)||1});
    }
    for(const [key,topic] of Object.entries(TOPICS)){
      const raw=pack.legacy?.[key];if(raw){const data=validate(topic,JSON.parse(raw));archives.push({topic,data,history:[],version:1});if(!chosen[topic])chosen[topic]=data;}
    }
    if(pack.legacy?.['familia-gh-backups-v2']){
      const oldHistory=JSON.parse(pack.legacy['familia-gh-backups-v2']);
      for(const [topic,versions] of Object.entries(oldHistory)){if(!Object.values(TOPICS).includes(topic))continue;for(const version of versions)archives.push({topic,data:validate(topic,JSON.parse(version.data)),history:[],version:1});}
    }
    if(pack.legacy?.['menu-semana']){const data=legacyMeals(pack.legacy['menu-semana']);archives.push({topic:'refeicoes',data,history:[],version:1});if(!chosen.refeicoes)chosen.refeicoes=data;}
    if(!Object.keys(chosen).length)throw Error('Não foram encontrados documentos nesta cópia.');
    for(const archive of archives)this.storage.setItem(`${this.prefix}${archive.topic}:imported:${this.id()}`,JSON.stringify({...archive,format:'family-draft',dirty:false,archived:true,revision:this.id(),at:new Date().toISOString()}));
    for(const [topic,data] of Object.entries(chosen))this.restore(topic,data);
    return Object.keys(chosen).length;
  }
  export() {
    const legacy = {};
    for (const key of [...Object.keys(TOPICS), 'menu-semana', 'familia-gh-dirty-v1', 'familia-gh-snapshot-v1', 'familia-gh-backups-v2']) {
      const raw = this.storage.getItem(key); if (raw !== null) legacy[key] = raw;
    }
    return { format: 'familia-supabase-recovery', version: 1, exportedAt: new Date().toISOString(), topics: clone(this.records), journals: Object.fromEntries(this.keys().map(key => [key, this.storage.getItem(key)])), legacy };
  }
  deactivate() { this.active = false; }
}
