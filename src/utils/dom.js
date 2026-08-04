export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => [...document.querySelectorAll(sel)];

export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class' || k === 'className') {
      el.className = v;
    } else if (k === 'style') {
      if (typeof v === 'string') {
        el.style.cssText = v;
      } else if (typeof v === 'object' && v !== null) {
        Object.assign(el.style, v);
      }
    } else if (typeof v === 'function') {
      const eventName = k.startsWith('on') ? k.slice(2).toLowerCase() : k.toLowerCase();
      el.addEventListener(eventName, v);
    } else {
      if (v !== false && v !== null && v !== undefined) {
        el.setAttribute(k, v === true ? '' : v);
      }
    }
  }
  for (const child of children) {
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

export function show(el) { if (el) el.style.display = ''; }
export function hide(el) { if (el) el.style.display = 'none'; }
export function toggle(el) { if (el) el.style.display = el.style.display === 'none' ? '' : 'none'; }

export function addClass(el, ...cls) { if (el) el.classList.add(...cls.filter(Boolean)); }
export function removeClass(el, ...cls) { if (el) el.classList.remove(...cls.filter(Boolean)); }
export function toggleClass(el, cls) { if (el) el.classList.toggle(cls); }

export function setHTML(el, html) { if (el) el.innerHTML = html; }
export function setText(el, text) { if (el) el.textContent = text; }

export function on(el, evt, handler, opts) { if (el) el.addEventListener(evt, handler, opts); }
export function off(el, evt, handler) { if (el) el.removeEventListener(evt, handler); }

export function animate(el, keyframes, options) {
  if (!el || !el.animate) return Promise.resolve();
  return el.animate(keyframes, options)?.finished || Promise.resolve();
}
