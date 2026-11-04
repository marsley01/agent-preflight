const region = process.env.REGION ?? 'eu'
export const load = () => fetch('http://localhost:3000/api/items')
export const ping = () => fetch(`http://127.0.0.1:8080/health?region=${region}`);
