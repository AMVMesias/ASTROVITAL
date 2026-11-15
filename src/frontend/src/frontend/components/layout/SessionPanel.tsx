"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError, writeRequest, type User } from "../../lib/api";
import { ThemeToggle } from "../ui/ThemeToggle";
export function SessionPanel({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User>();const [error,setError]=useState("");const path=usePathname(),router=useRouter();
  useEffect(()=>{let active=true;void api<{user:User}>("/v1/auth/session").then(({user})=>{
    if(!active)return;if(user.requiresOnboarding){router.replace("/login");return;}
    const adminPage=path.startsWith("/usuarios");
    if((adminPage&&user.role!=="admin")||(!adminPage&&user.role==="admin"&&path!=="/configuracion")){router.replace(user.role==="admin"?"/usuarios":"/dashboard");return;}
    setUser(user);
  }).catch(e=>{if(!active)return;if(e instanceof ApiError&&e.status===401)router.replace("/login");else setError(e.message);});return()=>{active=false;};},[path,router]);
  if(error)return <main className="interior"><p role="alert">{error}</p><button onClick={()=>location.reload()}>Reintentar</button></main>;
  if(!user)return <main className="interior"><p role="status">Comprobando sesión…</p></main>;
  return <><nav className="panel-nav" aria-label="Panel"><Link href="/">AstroVital</Link><ThemeToggle />
    {user.role==="admin"?<><Link href="/usuarios">Usuarios</Link><Link href="/usuarios/nuevo">Nuevo usuario</Link></>:<><Link href="/dashboard">Dashboard</Link><Link href="/reportes">Historial</Link></>}
    <Link href="/configuracion">Mi cuenta</Link><span>{user.name}</span>
    <button onClick={async()=>{try{await api("/v1/auth/logout",writeRequest("POST"));router.replace("/login");router.refresh();}catch(e){setError(e instanceof Error?e.message:"No se pudo cerrar la sesión.");}}}>Cerrar sesión</button>
  </nav>{children}</>;
}
