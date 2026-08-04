export default class EventEmitter {
  constructor() { this._listeners = {}; }
  on(event, cb) { (this._listeners[event] ??= []).push(cb); return this; }
  off(event, cb) { const l = this._listeners[event]; if(l) this._listeners[event] = l.filter(f => f !== cb); return this; }
  emit(event, data) { (this._listeners[event] || []).forEach(cb => cb(data)); return this; }
  once(event, cb) { const wrapper = (data) => { cb(data); this.off(event, wrapper); }; this.on(event, wrapper); return this; }
}
