const abaLogin = document.getElementById('aba-login');
const abaRegistro = document.getElementById('aba-registro');
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');

function mostrar(aba) {
  const login = aba === 'login';
  formLogin.classList.toggle('oculto', !login);
  formRegistro.classList.toggle('oculto', login);
  abaLogin.setAttribute('aria-selected', String(login));
  abaRegistro.setAttribute('aria-selected', String(!login));
}
abaLogin.addEventListener('click', () => mostrar('login'));
abaRegistro.addEventListener('click', () => mostrar('registro'));

async function enviar(form, caminho) {
  const botao = form.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const dados = Object.fromEntries(new FormData(form));
    const r = await api(caminho, 'POST', dados);
    location.href = r.redirect || '/';
  } catch (e) {
    aviso(e.message, 'erro');
    botao.disabled = false;
  }
}

formLogin.addEventListener('submit', (ev) => { ev.preventDefault(); enviar(formLogin, '/api/auth/login'); });
formRegistro.addEventListener('submit', (ev) => { ev.preventDefault(); enviar(formRegistro, '/api/auth/register'); });
