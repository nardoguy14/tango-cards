import { createApp } from "vue";
import App from "./App.vue";
import { boot } from "./store";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/library.css";
import "./styles/practice.css";
import "./styles/finder.css";
import "./styles/set.css";
import "./styles/study.css";
import "./styles/motion.css";

createApp(App).mount("#app");
boot();
