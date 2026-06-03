const state = {
  tasks: [],
  filter: "All",
  search: "",
  sort: "updatedAt",
  subscription: null
};

const elements = {
  taskForm: document.querySelector("#taskForm"),
  taskId: document.querySelector("#taskId"),
  title: document.querySelector("#title"),
  project: document.querySelector("#project"),
  owner: document.querySelector("#owner"),
  status: document.querySelector("#status"),
  priority: document.querySelector("#priority"),
  dueDate: document.querySelector("#dueDate"),
  notes: document.querySelector("#notes"),
  saveBtn: document.querySelector("#saveBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  taskList: document.querySelector("#taskList"),
  taskTemplate: document.querySelector("#taskTemplate"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  refreshBtn: document.querySelector("#refreshBtn"),
  connectionText: document.querySelector("#connectionText"),
  countTotal: document.querySelector("#countTotal"),
  countProgress: document.querySelector("#countProgress"),
  countDone: document.querySelector("#countDone")
};

function getSupabaseClient() {
  const config = window.SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || config.url.includes("YOUR_")) {
    throw new Error("Add your Supabase URL and anon key in public/config.js");
  }
  if (!window.supabase) {
    throw new Error("Supabase library did not load. Check your internet connection.");
  }
  return window.supabase.createClient(config.url, config.anonKey);
}

let db;
try {
  db = getSupabaseClient();
} catch (error) {
  elements.connectionText.textContent = error.message;
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title || "",
    project: row.project || "",
    owner: row.owner || "",
    status: row.status || "To Do",
    priority: row.priority || "Medium",
    dueDate: row.due_date || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRow(task) {
  return {
    title: task.title.trim(),
    project: task.project.trim(),
    owner: task.owner.trim(),
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate || null,
    notes: task.notes.trim()
  };
}

async function loadTasks() {
  if (!db) return;

  try {
    elements.connectionText.textContent = "Loading shared tasks...";
    const { data, error } = await db
      .from("tasks")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    state.tasks = (data || []).map(fromRow);
    elements.connectionText.textContent = `Supabase connected - ${new Date().toLocaleTimeString()}`;
    render();
  } catch (error) {
    elements.connectionText.textContent = error.message;
  }
}

function getFormData() {
  return {
    title: elements.title.value,
    project: elements.project.value,
    owner: elements.owner.value,
    status: elements.status.value,
    priority: elements.priority.value,
    dueDate: elements.dueDate.value,
    notes: elements.notes.value
  };
}

function resetForm() {
  elements.taskForm.reset();
  elements.taskId.value = "";
  elements.priority.value = "Medium";
  elements.status.value = "To Do";
  elements.saveBtn.textContent = "Add Task";
  elements.cancelEditBtn.classList.add("hidden");
}

async function saveTask(event) {
  event.preventDefault();
  if (!db) return;

  const task = getFormData();
  if (!task.title.trim()) return;

  const id = elements.taskId.value;
  const payload = toRow(task);
  const response = id
    ? await db.from("tasks").update(payload).eq("id", id).select().single()
    : await db.from("tasks").insert(payload).select().single();

  if (response.error) {
    elements.connectionText.textContent = response.error.message;
    return;
  }

  resetForm();
  await loadTasks();
}

function editTask(task) {
  elements.taskId.value = task.id;
  elements.title.value = task.title;
  elements.project.value = task.project;
  elements.owner.value = task.owner;
  elements.status.value = task.status;
  elements.priority.value = task.priority;
  elements.dueDate.value = task.dueDate;
  elements.notes.value = task.notes;
  elements.saveBtn.textContent = "Save Changes";
  elements.cancelEditBtn.classList.remove("hidden");
  elements.title.focus();
}

async function deleteTask(id) {
  if (!db) return;

  const confirmed = window.confirm("Delete this task from the shared tracker?");
  if (!confirmed) return;
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) {
    elements.connectionText.textContent = error.message;
    return;
  }
  await loadTasks();
}

async function changeStatus(task, status) {
  if (!db) return;

  const { error } = await db.from("tasks").update({ status }).eq("id", task.id);
  if (error) {
    elements.connectionText.textContent = error.message;
    return;
  }
  await loadTasks();
}

function priorityRank(priority) {
  return { Urgent: 4, High: 3, Medium: 2, Low: 1 }[priority] || 0;
}

function filteredTasks() {
  const search = state.search.trim().toLowerCase();
  const tasks = state.tasks.filter(task => {
    const matchesStatus = state.filter === "All" || task.status === state.filter;
    const haystack = [task.title, task.project, task.owner, task.notes, task.priority, task.status]
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!search || haystack.includes(search));
  });

  return tasks.sort((a, b) => {
    if (state.sort === "priority") return priorityRank(b.priority) - priorityRank(a.priority);
    if (state.sort === "dueDate") return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    if (state.sort === "project") return (a.project || "").localeCompare(b.project || "");
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function formatMeta(task) {
  const parts = [];
  if (task.project) parts.push(`Project: ${task.project}`);
  if (task.owner) parts.push(`Owner: ${task.owner}`);
  if (task.dueDate) parts.push(`Due: ${task.dueDate}`);
  parts.push(`Status: ${task.status}`);
  return parts;
}

function updateStats() {
  elements.countTotal.textContent = state.tasks.length;
  elements.countProgress.textContent = state.tasks.filter(task => task.status !== "Done").length;
  elements.countDone.textContent = state.tasks.filter(task => task.status === "Done").length;
}

function render() {
  updateStats();
  const tasks = filteredTasks();
  elements.taskList.innerHTML = "";

  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No tasks match the current view.";
    elements.taskList.append(empty);
    return;
  }

  tasks.forEach(task => {
    const card = elements.taskTemplate.content.cloneNode(true);
    const article = card.querySelector(".task-card");
    const title = card.querySelector("h3");
    const priority = card.querySelector(".priority-pill");
    const meta = card.querySelector(".task-meta");
    const notes = card.querySelector(".task-notes");
    const statusPicker = card.querySelector(".status-picker");
    const editBtn = card.querySelector(".edit-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    article.style.borderLeftColor = task.status === "Done" ? "#16745f" : task.status === "Blocked" ? "#b42318" : "";
    title.textContent = task.title;
    priority.textContent = task.priority;
    priority.classList.add(task.priority.toLowerCase());
    meta.textContent = formatMeta(task).join(" - ");
    notes.textContent = task.notes;
    statusPicker.value = task.status;

    statusPicker.addEventListener("change", event => changeStatus(task, event.target.value));
    editBtn.addEventListener("click", () => editTask(task));
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    elements.taskList.append(card);
  });
}

document.querySelectorAll(".status-tabs button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".status-tabs button").forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.status;
    render();
  });
});

elements.taskForm.addEventListener("submit", saveTask);
elements.cancelEditBtn.addEventListener("click", resetForm);
elements.refreshBtn.addEventListener("click", loadTasks);
elements.searchInput.addEventListener("input", event => {
  state.search = event.target.value;
  render();
});
elements.sortSelect.addEventListener("change", event => {
  state.sort = event.target.value;
  render();
});

loadTasks();

if (db) {
  state.subscription = db
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadTasks)
    .subscribe();
}
