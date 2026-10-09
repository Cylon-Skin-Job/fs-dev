import { renderChecklist } from './checklist-view.js';

const samples = [
  { id: 'draft', label: 'Draft report' },
  { id: 'review', label: 'Review sources' },
  { id: 'send', label: 'Send summary' },
];
const stored = JSON.parse(localStorage.getItem('checklist-completed') || '[]');
const tasks = samples.map((task) => ({ ...task, completed: stored.includes(task.id) }));

function refresh() {
  renderChecklist(tasks, tasks.length, (id, completed) => {
    tasks.find((task) => task.id === id).completed = completed;
    localStorage.setItem('checklist-completed', JSON.stringify(tasks.filter((task) => task.completed).map((task) => task.id)));
    refresh();
  });
}
refresh();
