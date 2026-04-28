import "./firebase-config.js";

const services = window.firebaseServices;


const state = {
  mode: services?.isConfigured ? "firebase" : "local",
  user: null,
  tasks: [],
  habits: [],
  selectedTaskId: null,
  unsubscribers: [],
};

const ENERGY = {
  3: { label: "Высокая энергия", color: "3" },
  2: { label: "Средняя энергия", color: "2" },
  1: { label: "Низкая энергия", color: "1" },
};

const els = {
  syncStatus: document.getElementById("syncStatus"),
  googleSignInBtn: document.getElementById("googleSignInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  authHint: document.getElementById("authHint"),
  userInfo: document.getElementById("userInfo"),
  userAvatar: document.getElementById("userAvatar"),
  userName: document.getElementById("userName"),
  userEmail: document.getElementById("userEmail"),
  taskForm: document.getElementById("taskForm"),
  taskTitleInput: document.getElementById("taskTitleInput"),
  taskEnergyInput: document.getElementById("taskEnergyInput"),
  habitForm: document.getElementById("habitForm"),
  habitTitleInput: document.getElementById("habitTitleInput"),
  tasksList: document.getElementById("tasksList"),
  completedTasksList: document.getElementById("completedTasksList"),
  habitsList: document.getElementById("habitsList"),
  activeTasksCount: document.getElementById("activeTasksCount"),
  completedTasksCount: document.getElementById("completedTasksCount"),
  focusTaskEmpty: document.getElementById("focusTaskEmpty"),
  focusTaskContent: document.getElementById("focusTaskContent"),
  focusTaskTitle: document.getElementById("focusTaskTitle"),
  focusTaskMeta: document.getElementById("focusTaskMeta"),
  completeFocusTaskBtn: document.getElementById("completeFocusTaskBtn"),
  taskItemTemplate: document.getElementById("taskItemTemplate"),
  habitItemTemplate: document.getElementById("habitItemTemplate"),
};

function getLocalStorageKey(name) {
  const userPart = state.user?.id ?? "guest";
  return `energy-tracker:${userPart}:${name}`;
}

function saveLocalCollection(name, data) {
  localStorage.setItem(getLocalStorageKey(name), JSON.stringify(data));
}

function loadLocalCollection(name) {
  const raw = localStorage.getItem(getLocalStorageKey(name));
  return raw ? JSON.parse(raw) : [];
}

function setSyncStatus(text) {
  els.syncStatus.textContent = text;
}

function formatDate(input) {
  if (!input) return "без даты";
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isHabitCompletedToday(lastCompletedDate) {
  if (!lastCompletedDate) return false;
  const date = new Date(lastCompletedDate);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function teardownListeners() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function renderAuth() {
  const signedIn = Boolean(state.user);
  const isLocalMode = state.mode === "local";
  const hasCloudUser = signedIn && !isLocalMode;
  els.googleSignInBtn.classList.toggle("hidden", hasCloudUser || isLocalMode);
  els.signOutBtn.classList.toggle("hidden", !hasCloudUser);
  els.userInfo.classList.toggle("hidden", !signedIn);

  if (signedIn) {
    els.userAvatar.src = state.user.photoURL || "./assets/icon.svg";
    els.userName.textContent = state.user.displayName || "Пользователь";
    els.userEmail.textContent = state.user.email || "Локальный режим";
  }

  if (state.mode === "local") {
    els.authHint.textContent = "Локальный режим включён. Для real-time sync добавь ключи в firebase-config.js.";
  } else {
    els.authHint.textContent = signedIn
      ? "Данные синхронизируются через Firestore в реальном времени."
      : "Войди через Google, чтобы включить облачную синхронизацию.";
  }
}

function updateFormAvailability() {
  const canEdit = state.mode === "local" || Boolean(state.user);
  const disabled = !canEdit;

  [els.taskTitleInput, els.taskEnergyInput, els.habitTitleInput].forEach((field) => {
    field.disabled = disabled;
  });

  els.taskForm.querySelector("button[type='submit']").disabled = disabled;
  els.habitForm.querySelector("button[type='submit']").disabled = disabled;
}

function renderFocusTask() {
  const activeTasks = state.tasks.filter((task) => !task.is_done);
  const focusTask = activeTasks.find((task) => task.id === state.selectedTaskId);

  const hasFocusTask = Boolean(focusTask);
  els.focusTaskEmpty.classList.toggle("hidden", hasFocusTask);
  els.focusTaskContent.classList.toggle("hidden", !hasFocusTask);

  if (!focusTask) {
    els.focusTaskEmpty.textContent = activeTasks.length
      ? "Выбери уровень энергии, и приложение предложит случайную задачу."
      : "Список задач пока пуст. Добавь первую задачу ниже.";
    return;
  }

  els.focusTaskTitle.textContent = focusTask.title;
  els.focusTaskMeta.textContent = `${ENERGY[focusTask.energy_level].label} • создано ${formatDate(focusTask.created_at)}`;
}

function renderTasks() {
  const activeTasks = state.tasks.filter((task) => !task.is_done);
  const completedTasks = state.tasks.filter((task) => task.is_done);

  els.activeTasksCount.textContent = String(activeTasks.length);
  els.completedTasksCount.textContent = String(completedTasks.length);

  renderTaskList(els.tasksList, activeTasks);
  renderTaskList(els.completedTasksList, completedTasks);
  renderFocusTask();
}

function renderTaskList(container, tasks) {
  container.innerHTML = "";

  if (!tasks.length) {
    container.innerHTML = `<p class="helper-text">Пока пусто.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  tasks.forEach((task) => {
    const node = els.taskItemTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-done", task.is_done);
    node.dataset.id = task.id;

    const pill = node.querySelector(".energy-pill");
    pill.dataset.energy = String(task.energy_level);
    pill.textContent = ENERGY[task.energy_level].label;

    node.querySelector(".task-item__title").textContent = task.title;
    node.querySelector(".task-item__meta").textContent = `Создано ${formatDate(task.created_at)}`;

    const toggleBtn = node.querySelector(".task-toggle-btn");
    toggleBtn.textContent = task.is_done ? "Вернуть" : "Готово";
    toggleBtn.addEventListener("click", () => toggleTask(task.id, !task.is_done));

    node.querySelector(".task-delete-btn").addEventListener("click", () => deleteTask(task.id));
    fragment.appendChild(node);
  });

  container.appendChild(fragment);
}

function renderHabits() {
  els.habitsList.innerHTML = "";

  if (!state.habits.length) {
    els.habitsList.innerHTML = `<p class="helper-text">Привычек пока нет.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.habits.forEach((habit) => {
    const node = els.habitItemTemplate.content.firstElementChild.cloneNode(true);
    const completedToday = isHabitCompletedToday(habit.last_completed_date);
    node.classList.toggle("is-done", completedToday);
    node.dataset.id = habit.id;

    const checkbox = node.querySelector(".habit-item__checkbox");
    checkbox.checked = completedToday;
    checkbox.addEventListener("change", () => updateHabitCompletion(habit.id, checkbox.checked));

    node.querySelector(".habit-item__title").textContent = habit.title;
    node.querySelector(".habit-item__meta").textContent = completedToday
      ? `Отмечено сегодня в ${formatDate(habit.last_completed_date)}`
      : "Ещё не отмечено сегодня";

    node.querySelector(".habit-delete-btn").addEventListener("click", (event) => {
      event.preventDefault();
      deleteHabit(habit.id);
    });

    fragment.appendChild(node);
  });

  els.habitsList.appendChild(fragment);
}

function renderAll() {
  renderAuth();
  updateFormAvailability();
  renderTasks();
  renderHabits();
}

function selectRandomTask(energyLevel) {
  const matches = state.tasks.filter((task) => !task.is_done && Number(task.energy_level) === Number(energyLevel));

  if (!matches.length) {
    state.selectedTaskId = null;
    els.focusTaskEmpty.textContent = "Для этого уровня энергии активных задач нет. Добавь новую или выбери другой уровень.";
    renderFocusTask();
    return;
  }

  const randomTask = matches[Math.floor(Math.random() * matches.length)];
  state.selectedTaskId = randomTask.id;
  renderFocusTask();
}

async function addTask(title, energyLevel) {
  if (state.mode === "firebase" && !state.user) {
    setSyncStatus("Сначала войди через Google");
    return;
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  if (state.mode === "firebase" && state.user) {
    await services.addDoc(services.collection(services.db, "tasks"), {
      title: cleanTitle,
      energy_level: Number(energyLevel),
      is_done: false,
      created_at: services.serverTimestamp(),
      user_id: state.user.id,
    });
    return;
  }

  const task = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    energy_level: Number(energyLevel),
    is_done: false,
    created_at: new Date().toISOString(),
    user_id: state.user.id,
  };
  state.tasks = [task, ...state.tasks];
  saveLocalCollection("tasks", state.tasks);
  renderTasks();
}

async function toggleTask(taskId, nextValue) {
  if (state.mode === "firebase" && state.user) {
    await services.updateDoc(services.doc(services.db, "tasks", taskId), {
      is_done: nextValue,
    });
    if (nextValue && state.selectedTaskId === taskId) {
      state.selectedTaskId = null;
    }
    return;
  }

  state.tasks = state.tasks.map((task) => (
    task.id === taskId ? { ...task, is_done: nextValue } : task
  ));
  if (nextValue && state.selectedTaskId === taskId) {
    state.selectedTaskId = null;
  }
  saveLocalCollection("tasks", state.tasks);
  renderTasks();
}

async function deleteTask(taskId) {
  if (state.mode === "firebase" && state.user) {
    await services.deleteDoc(services.doc(services.db, "tasks", taskId));
    if (state.selectedTaskId === taskId) {
      state.selectedTaskId = null;
    }
    return;
  }

  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  if (state.selectedTaskId === taskId) {
    state.selectedTaskId = null;
  }
  saveLocalCollection("tasks", state.tasks);
  renderTasks();
}

async function addHabit(title) {
  if (state.mode === "firebase" && !state.user) {
    setSyncStatus("Сначала войди через Google");
    return;
  }

  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  if (state.mode === "firebase" && state.user) {
    await services.addDoc(services.collection(services.db, "habits"), {
      title: cleanTitle,
      last_completed_date: null,
      user_id: state.user.id,
    });
    return;
  }

  const habit = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    last_completed_date: null,
    user_id: state.user.id,
  };
  state.habits = [habit, ...state.habits];
  saveLocalCollection("habits", state.habits);
  renderHabits();
}

async function updateHabitCompletion(habitId, completed) {
  const value = completed ? new Date().toISOString() : null;

  if (state.mode === "firebase" && state.user) {
    await services.updateDoc(services.doc(services.db, "habits", habitId), {
      last_completed_date: value,
    });
    return;
  }

  state.habits = state.habits.map((habit) => (
    habit.id === habitId ? { ...habit, last_completed_date: value } : habit
  ));
  saveLocalCollection("habits", state.habits);
  renderHabits();
}

async function deleteHabit(habitId) {
  if (state.mode === "firebase" && state.user) {
    await services.deleteDoc(services.doc(services.db, "habits", habitId));
    return;
  }

  state.habits = state.habits.filter((habit) => habit.id !== habitId);
  saveLocalCollection("habits", state.habits);
  renderHabits();
}

function hydrateLocalData() {
  state.tasks = loadLocalCollection("tasks").sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  state.habits = loadLocalCollection("habits");
  renderAll();
}

function subscribeToFirestore() {
  if (!state.user) return;
  teardownListeners();

  const tasksQuery = services.query(
    services.collection(services.db, "tasks"),
    services.where("user_id", "==", state.user.id),
    services.orderBy("created_at", "desc"),
  );

  const habitsQuery = services.query(
    services.collection(services.db, "habits"),
    services.where("user_id", "==", state.user.id),
  );

  state.unsubscribers.push(
    services.onSnapshot(tasksQuery, (snapshot) => {
      state.tasks = snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          ...data,
          created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
        };
      });
      renderTasks();
    }),
  );

  state.unsubscribers.push(
    services.onSnapshot(habitsQuery, (snapshot) => {
      state.habits = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));
      renderHabits();
    }),
  );
}

async function signInWithGoogle() {
  try {
    const provider = new services.GoogleAuthProvider();
    // Теперь используем Redirect. Это гарантированно работает на всех телефонах!
    await services.signInWithRedirect(services.auth, provider);
  } catch (error) {
    console.error(error);
    setSyncStatus("Не удалось перенаправить на вход");
  }
}

async function signOutCurrentUser() {
  if (state.mode === "firebase") {
    await services.signOut(services.auth);
  } else {
    teardownListeners();
    bootstrapLocalMode();
  }
}

function bootstrapLocalMode() {
  state.mode = "local";
  state.user = {
    id: "guest",
    displayName: "Локальный профиль",
    email: "demo@local.device",
    photoURL: "",
  };
  state.selectedTaskId = null;
  setSyncStatus("Локальный режим");
  hydrateLocalData();
}

function bootstrapFirebaseMode() {
  state.mode = "firebase";
  state.user = null;
  state.tasks = [];
  state.habits = [];
  state.selectedTaskId = null;
  setSyncStatus("Проверка авторизации...");
  renderAll();

  // Магия слушателя: он сам понимает, когда ты вошел, и РАЗБЛОКИРУЕТ формы
  services.onAuthStateChanged(services.auth, (user) => {
    if (user) {
      state.user = {
        id: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      };
      setSyncStatus("Firebase sync активен");
      subscribeToFirestore();
    } else {
      state.user = null;
      setSyncStatus("Ожидание входа");
      teardownListeners();
      state.tasks = [];
      state.habits = [];
    }
    renderAll(); // Именно этот вызов включает поля ввода!
  });
}
function bindEvents() {
  document.querySelectorAll("[data-energy-level]").forEach((button) => {
    button.addEventListener("click", () => selectRandomTask(button.dataset.energyLevel));
  });

  els.completeFocusTaskBtn.addEventListener("click", async () => {
    if (state.selectedTaskId) {
      await toggleTask(state.selectedTaskId, true);
    }
  });

  els.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addTask(els.taskTitleInput.value, els.taskEnergyInput.value);
    els.taskForm.reset();
    els.taskEnergyInput.value = "3";
  });

  els.habitForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addHabit(els.habitTitleInput.value);
    els.habitForm.reset();
  });

  els.googleSignInBtn.addEventListener("click", signInWithGoogle);
  els.signOutBtn.addEventListener("click", signOutCurrentUser);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }
}

function init() {
  bindEvents();
  registerServiceWorker();

  if (services?.isConfigured) {
    bootstrapFirebaseMode();
  } else {
    bootstrapLocalMode();
  }
}

init();
