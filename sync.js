// Compatibilidade com páginas antigas em cache. Não lê dados nem usa tokens GitHub.
(function(){
 document.documentElement.style.visibility='hidden';
 const page=location.pathname.split('/').pop();
 const allowed=['index.html','menu.html','viaturas.html','compras.html','compromissos.html'];
 window.GHSync={load:()=>new Promise(()=>{}),render(){},changed(){throw Error('É necessário atualizar a aplicação.')}};
 location.replace('entrar.html?next='+encodeURIComponent(allowed.includes(page)?page:'index.html'));
})();
