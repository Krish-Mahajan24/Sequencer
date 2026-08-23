(function () {
  'use strict';
  const SESSION_KEY = 'sequencer_current_user_v1';
  window.SequencerStore = {
    session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } },
    userId() { const s=this.session(); return s && s.id ? s.id : 'guest'; },
    key(name) { return `sequencer_${name}_${this.userId()}`; },
    get(name, fallback) { try { const v=localStorage.getItem(this.key(name)); return v===null?fallback:JSON.parse(v); } catch { return fallback; } },
    set(name, value) { try { localStorage.setItem(this.key(name), JSON.stringify(value)); } catch {} }
  };
})();
