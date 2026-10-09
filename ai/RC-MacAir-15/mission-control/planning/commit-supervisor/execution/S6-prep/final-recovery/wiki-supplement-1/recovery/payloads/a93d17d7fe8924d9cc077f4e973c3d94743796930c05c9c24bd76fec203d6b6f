export function renderChecklist(tasks, remaining, onCompletion) {
  document.querySelector('#summary').textContent = `${remaining} remaining`;
  const rows = tasks.map((task) => {
    const row = document.createElement('label');
    row.className = 'rv-checklist-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => onCompletion(task.id, checkbox.checked));
    row.append(checkbox, document.createTextNode(task.label));
    return row;
  });
  document.querySelector('#tasks').replaceChildren(...rows);
}
