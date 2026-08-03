// Global State Store

class Store {
  constructor() {
    this.state = {
      activeTab: 'dashboard',
      currentUser: null,
      tasksData: { teamTasks: [], challenges: [], marketplace: [] },
      teamsData: [],
      hallOfFameData: { allTime: [], season1: [], titles: [] }
    };
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const store = new Store();
