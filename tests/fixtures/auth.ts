import type { createServices } from "../../src/backend/src/backend/composition/local";
export function onboardingBody(newPassword:string) {
  return {newPassword,confirmation:newPassword,answers:[
    {questionId:"first-pet",answer:"Gato de prueba"},
    {questionId:"childhood-city",answer:"Quito de prueba"},
    {questionId:"first-school",answer:"Escuela de prueba"},
  ]};
}
export function onboard(app:ReturnType<typeof createServices>,username:string,initialPassword:string,newPassword:string) {
  const session=app.auth.session(app.auth.login({username,password:initialPassword}).token);
  app.recovery.completeOnboarding(session,onboardingBody(newPassword));
}
