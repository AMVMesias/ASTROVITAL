"use client";
import {useEffect,useState} from "react";
import {api,type User} from "../../../frontend/lib/api";
export default function Page(){const [user,setUser]=useState<User>(),[error,setError]=useState("");const [status,setStatus]=useState<{securityQuestionsConfigured:boolean;recoveryLocked:boolean}>();
useEffect(()=>{void Promise.all([api<{user:User}>("/v1/auth/session"),api<{securityQuestionsConfigured:boolean;recoveryLocked:boolean}>("/v1/auth/onboarding")]).then(([session,recovery])=>{setUser(session.user);setStatus(recovery);}).catch(e=>setError(e.message));},[]);
return <main className="interior"><h1>Mi cuenta</h1>{error&&<p role="alert">{error}</p>}{user&&<dl><dt>Usuario</dt><dd>{user.username}</dd><dt>Nombre</dt><dd>{user.name}</dd><dt>Rol</dt><dd>{user.role}</dd><dt>Preguntas de seguridad</dt><dd>{status?.securityQuestionsConfigured?"Configuradas":"Sin configurar"}</dd><dt>Recuperación</dt><dd>{status?.recoveryLocked?"Bloqueada; contacta al administrador":"Disponible"}</dd></dl>}<p>Para cambiar una contraseña configurada, utiliza la recuperación desde la pantalla de acceso.</p></main>;}
