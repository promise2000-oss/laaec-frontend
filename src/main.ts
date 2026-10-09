import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { installSessionSync, useSessionStore } from './stores/session';
import './styles/layers.css';
import './styles/base.css';

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(router);

/*
 * Seed the session from storage BEFORE the first render (D-71). Every console
 * filters its rail against the session's permissions, so mounting first would
 * paint an empty rail and fill it in a frame later.
 */
useSessionStore().syncLocal();

app.mount('#app');

/* Re-reads roles and permissions on every navigation, on focus and every 30 s,
   so a grant change reaches the rail without a re-login (D-71). */
installSessionSync(router);
