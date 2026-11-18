import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import {createPhotoHandler} from './handler.js';
Deno.serve(createPhotoHandler({
 apiKey:Deno.env.get('OPENAI_API_KEY'),
 model:Deno.env.get('OPENAI_VISION_MODEL')||'gpt-4.1-mini',
 authorize:async(token:string)=>{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key)throw Error('config');
  const client=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await client.auth.getUser(token);if(error||!user)return null;
  const {data:member,error:memberError}=await client.from('familia_membros').select('user_id').eq('user_id',user.id).maybeSingle();
  if(memberError)throw Error('membership');
  return member?user.id:null;
 }
}));
