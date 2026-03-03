export class EventEmitter {
    constructor() { this.events = {}; }
    on(event, listener) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
        return this;
    }
    emit(event, ...args) {
        if (!this.events[event]) return false;
        this.events[event].forEach(listener => listener(...args));
        return true;
    }
    removeListener(event, listener) {
        if (!this.events[event]) return this;
        this.events[event] = this.events[event].filter(l => l !== listener);
        return this;
    }
    off(event, listener) { return this.removeListener(event, listener); }
    once(event, listener) {
        const onceListener = (...args) => {
            listener(...args);
            this.off(event, onceListener);
        };
        this.on(event, onceListener);
        return this;
    }
    removeAllListeners(event) {
        if (event) delete this.events[event];
        else this.events = {};
        return this;
    }
    listenerCount(event) { return this.events[event] ? this.events[event].length : 0; }
}
export default { EventEmitter };
