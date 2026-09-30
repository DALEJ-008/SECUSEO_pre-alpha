/*Este servicio sirve para hacer peticiones HTTP al backend, 
manteniendo la sesión de usuario mediante cookies y manejando 
automáticamente el token CSRF para peticiones POST.*/


//Le las cookies del navegador y devuelve el valor de la cookie con el nombre especificado.
export function getCookie(name) { //contiene las cookies del navegador
  const value = `; ${document.cookie}`;//agrega un punto y coma al inicio de las cookies para facilitar la búsqueda 
  const parts = value.split(`; ${name}=`); //divide las cookies en partes usando el nombre de la cookie como separador
  if (parts.length === 2) return parts.pop().split(';').shift(); //toma el valor de la cookie si se encuentra, de lo contrario devuelve null
  return null;
} 

//Realiza una petición HTTP al backend, incluyendo las cookies de sesión y el token CSRF si es necesario.
export async function apiFetch(url, options = {}) {
  const opts = {
    credentials: 'include', //envia cookies del dominio al backend para mantener la sesión de usuario
    cache: options.cache || 'no-store', //evita que el navegador almacene en caché la respuesta de la petición
    ...options, //sobrescribe las opciones por defecto con las opciones proporcionadas por el usuario
  };
  const method = (opts.method || 'GET').toUpperCase(); //convierte el método HTTP a mayúsculas para compararlo con 'GET' y 'HEAD'
  if (method !== 'GET' && method !== 'HEAD') { //si el método HTTP no es GET ni HEAD, se agrega el token CSRF a las cabeceras de la petición
    opts.headers = {
      ...(opts.headers || {}),
      'X-CSRFToken': getCookie('csrftoken') || '',
    }; //agrega el token CSRF a las cabeceras de la petición para proteger contra ataques CSRF
  }
  return fetch(url, opts); //realiza la petición HTTP al backend y devuelve la respuesta
}

//Realiza una petición HTTP al backend y devuelve la respuesta en formato JSON, junto con el objeto Response.
export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options); //realiza la petición HTTP al backend usando la función apiFetch
  let data = null; 
  try { data = await res.json(); } catch (e) { /* respuesta sin cuerpo JSON */ } //intenta convertir la respuesta a formato JSON, si falla, data se mantiene como null
  return { res, data }; //devuelve un objeto con la respuesta y los datos en formato JSON (si están disponibles)
}
