// Простой трекер задач — клиентская логика.

let tasks = [];
let currentFilter = 'all'; // all | active | done

const listEl = document.getElementById('task-list');
const counterEl = document.getElementById('counter');
const formEl = document.getElementById('add-form');
const titleInput = document.getElementById('title-input');
const prioritySelect = document.getElementById('priority-select');
const filtersEl = document.getElementById('filters');

init();

function init() {
  formEl.addEventListener('submit', addTask);
  filtersEl.addEventListener('click', onFilterClick);
  loadTasks();
}

async function loadTasks() {
  const res = await fetch('/api/tasks');
  tasks = await res.json();
  render();
}

function onFilterClick(e) {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  [...filtersEl.querySelectorAll('.filter-btn')].forEach(b =>
    b.classList.toggle('active', b === btn)
  );
  render();
}

async function addTask(e) {
  e.preventDefault();

  const title = titleInput.value;
  const priority = prioritySelect.value;

  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, priority })
  });
  const created = await res.json();
  tasks.push(created);
  titleInput.value = '';
  render();
}

async function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: task.title, priority: task.priority, done: !task.done })
  });
  const updated = await res.json();
  Object.assign(task, updated);
  render();
}

function startEdit(id) {
  render(id);
}

function cancelEdit() {
  render();
}

function saveEdit(id, newTitle) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  // Обновляем заголовок локально, чтобы интерфейс сразу показал результат.
  task.title = newTitle;
  render();

  // TODO: отправить изменение на сервер (PUT /api/tasks/:id),
  // пока сохраняется только во временном состоянии вкладки.
}

async function deleteTask(index) {
  const task = tasks[index];
  if (!task) return;

  await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
  tasks.splice(index, 1);
  render();
}

function getFilteredTasks() {
  if (currentFilter === 'active') {
    return tasks.filter(t => t.done);
  }
  if (currentFilter === 'done') {
    return tasks.filter(t => !t.done);
  }
  return tasks;
}

function updateCounter() {
  counterEl.textContent = `Осталось задач: ${tasks.length}`;
}

function render(editingId) {
  const filtered = getFilteredTasks();
  listEl.innerHTML = '';

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Задач не найдено';
    listEl.appendChild(li);
  } else {
    filtered.forEach((task, index) => {
      listEl.appendChild(createTaskElement(task, index, task.id === editingId));
    });
  }

  updateCounter();
}

function createTaskElement(task, index, isEditing) {
  const li = document.createElement('li');
  li.className = 'task' + (task.done ? ' task--done' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.done;
  checkbox.addEventListener('change', () => toggleDone(task.id));
  li.appendChild(checkbox);

  if (isEditing) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-title-input';
    input.value = task.title;
    li.appendChild(input);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'icon-btn';
    saveBtn.textContent = 'Сохранить';
    saveBtn.addEventListener('click', () => saveEdit(task.id, input.value));
    li.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'icon-btn';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', cancelEdit);
    li.appendChild(cancelBtn);

    return li;
  }

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;
  li.appendChild(title);

  const badge = document.createElement('span');
  badge.className = 'badge badge-' + task.priority;
  badge.textContent = priorityLabel(task.priority);
  li.appendChild(badge);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.textContent = 'Изменить';
  editBtn.addEventListener('click', () => startEdit(task.id));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'icon-btn danger';
  deleteBtn.textContent = 'Удалить';
  deleteBtn.addEventListener('click', () => deleteTask(index));
  actions.appendChild(deleteBtn);

  li.appendChild(actions);
  return li;
}

function priorityLabel(priority) {
  switch (priority) {
    case 'high': return 'Высокий';
    case 'medium': return 'Средний';
    case 'low': return 'Низкий';
    default: return priority;
  }
}
