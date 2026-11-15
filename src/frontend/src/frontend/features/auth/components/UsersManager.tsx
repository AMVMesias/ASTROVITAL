"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api,writeRequest,type User } from "../../../lib/api";
export function UsersManager({create=false}:{create?:boolean}) {
 const [users,setUsers]=useState<User[]>([]),[editing,setEditing]=useState<User|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[pending,setPending]=useState(false);const router=useRouter();
 async function load(){setUsers((await api<{users:User[]}>("/v1/users")).users);}
 useEffect(()=>{let active=true;if(!create)void api<{users:User[]}>("/v1/users").then(r=>{if(active)setUsers(r.users);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[create]);
 async function unlock(user:User){setPending(true);setError("");try{await api(`/v1/users/${user.id}/recovery/unlock`,writeRequest("POST"));setNotice(`Recuperación desbloqueada para ${user.username}.`);}catch(e){setError(e instanceof Error?e.message:"Error");}finally{setPending(false);}}
 return <main className="interior"><h1>{create?"Nuevo usuario":"Usuarios"}</h1>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {(create||editing)&&<form className="data-form" key={editing?.id??"new"} onSubmit={async event=>{
 event.preventDefault();const form=event.currentTarget,data=new FormData(form);setPending(true);setError("");
 const password=String(data.get("password"));const body={username:String(data.get("username")),name:String(data.get("name")),role:String(data.get("role")),enabled:data.get("enabled")==="on",...(password?{password}:{})};
 try{await api(`/v1/users${editing?`/${editing.id}`:""}`,writeRequest(editing?"PATCH":"POST",body));setNotice("Cuenta guardada. Una contraseña nueva requiere completar el primer acceso.");setEditing(null);form.reset();if(create)router.push("/usuarios");else await load();}catch(e){setError(e instanceof Error?e.message:"Error");}finally{setPending(false);}
 }}>
 <label>Usuario<input name="username" required minLength={3} maxLength={64} pattern="[a-zA-Z0-9._-]+" defaultValue={editing?.username}/></label>
 <label>Nombre<input name="name" required maxLength={120} defaultValue={editing?.name}/></label>
 <label>Rol<select name="role" defaultValue={editing?.role??"astronauta"}><option value="astronauta">Astronauta</option><option value="admin">Administrador</option></select></label>
 <label>{editing?"Nueva contraseña (opcional)":"Contraseña inicial"}<input name="password" type="password" required={!editing} minLength={12} maxLength={128} autoComplete="new-password"/></label>
 <label><input type="checkbox" name="enabled" defaultChecked={editing?.enabled??true}/>Cuenta habilitada</label>
 <button disabled={pending}>Guardar usuario</button>{editing&&<button type="button" onClick={()=>setEditing(null)}>Cancelar</button>}
 </form>}
 {!create&&<div className="table-scroll"><table className="data-table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td>{user.username}</td><td>{user.name}</td><td>{user.role}</td><td>{user.enabled?"Habilitado":"Inhabilitado"}{user.requiresOnboarding?" · Primer acceso":""}</td><td><button disabled={pending} onClick={()=>setEditing(user)}>Editar</button> <button disabled={pending} onClick={()=>void unlock(user)}>Desbloquear recuperación</button></td></tr>)}</tbody></table></div>}
 </main>;
}
