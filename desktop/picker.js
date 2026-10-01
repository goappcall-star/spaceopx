let sources = [], type = 'window', selected = null;
const grid = document.querySelector('#sources');
const share = document.querySelector('#share');
const empty = document.querySelector('#empty');
function render() {
  grid.replaceChildren();
  const visible = sources.filter(source => source.id.startsWith(type + ':'));
  empty.hidden = visible.length > 0;
  empty.textContent = type === 'window' ? 'Nenhum aplicativo disponível. Abra uma janela ou escolha Telas.' : 'Nenhuma tela disponível.';
  for (const source of visible) {
    const button = document.createElement('button'); button.className = 'source'; button.setAttribute('aria-pressed', String(selected === source.id)); button.title = source.name;
    const preview = document.createElement('div'); preview.className = 'preview';
    const image = document.createElement('img'); image.src = source.thumbnail; image.alt = 'Prévia de ' + source.name; preview.append(image);
    const label = document.createElement('div'); label.className = 'name';
    if (source.icon) { const icon = document.createElement('img'); icon.src = source.icon; icon.alt = ''; label.append(icon); }
    const name = document.createElement('span'); name.textContent = source.name; label.append(name);
    button.append(preview, label);
    button.addEventListener('click', () => { selected = source.id; for (const item of grid.children) item.setAttribute('aria-pressed', String(item === button)); share.disabled = false; });
    grid.append(button);
  }
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  type = tab.dataset.type; selected = null; share.disabled = true;
  document.querySelectorAll('.tab').forEach(item => { item.classList.toggle('active', item === tab); item.setAttribute('aria-pressed', String(item === tab)); }); render();
}));
document.querySelector('#cancel').addEventListener('click', () => window.screenPicker.select(null));
share.addEventListener('click', () => { if(selected) { share.disabled = true; window.screenPicker.select(selected); } });
document.addEventListener('keydown', event => { if(event.key === 'Escape') window.screenPicker.select(null); });
window.screenPicker.sources().then(result => { sources = result; render(); }).catch(() => { empty.textContent = 'Não foi possível carregar as prévias. Feche e tente novamente.'; });
