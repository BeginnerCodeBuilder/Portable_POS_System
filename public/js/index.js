document.addEventListener('DOMContentLoaded', () => {
  const moduleLoader = document.getElementById('module-loader');

function loadModule(name) {
  const htmlPath = `./modules/${name}.html`;
  const cssPath = `./css/${name}.css`;
  const jsPath = `./js/${name}.js`;

  fetch(htmlPath)
    .then(res => res.text())
    .then(html => {
      moduleLoader.innerHTML = html;
      injectCSS(cssPath);

      // Wait for DOM elements to be in place before injecting JS
      requestAnimationFrame(() => {
        injectJS(jsPath);
      });
    })
    .catch(() => moduleLoader.innerHTML = '<p>Module not found.</p>');
}


  function injectCSS(href) {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  }

function injectJS(src) {
  const existing = document.querySelector(`script[src^="${src}"]`);
  if (existing) existing.remove();

  const script = document.createElement('script');
  script.src = src + '?v=' + Date.now();
  script.onload = () => console.log(`✅ JS injected: ${src}`);
  script.onerror = () => console.error(`❌ Failed to load JS: ${src}`);
  document.body.appendChild(script);
}


function updateClocks() {
  const now = new Date();

  // Format time
  const localTime = now.toLocaleTimeString();
  const phTime = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' });

  // Format date
  const localDate = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: '2-digit'
  });
  const phDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    .toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: '2-digit'
    });

  // Update text
  document.getElementById('local-time').firstChild.textContent = `Local Time: ${localTime} | `;
  document.getElementById('ph-time').firstChild.textContent = `PH Time: ${phTime} | `;
  document.getElementById('local-date').textContent = localDate;
  document.getElementById('ph-date').textContent = phDate;
}

  setInterval(updateClocks, 1000);
  updateClocks();

  document.querySelectorAll('.menu-item[data-module]').forEach(item => {
    item.addEventListener('click', () => {
      loadModule(item.dataset.module);
    });
  });

  document.querySelectorAll('.collapsible').forEach(item => {
    item.addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.collapsible').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });

  loadModule('rewards'); // Load default
});
