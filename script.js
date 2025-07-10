document.addEventListener('DOMContentLoaded', () => {
    const lists = document.querySelectorAll('.kanban-list');
    const addCardButtons = document.querySelectorAll('.add-card-btn');
    const modal = document.getElementById('taskModal');
    const closeButton = document.querySelector('.close-button');
    const taskForm = document.getElementById('taskForm');
    const modalTitle = document.getElementById('modalTitle');
    const taskIdInput = document.getElementById('taskId');
    const currentListIdInput = document.getElementById('currentListId'); // Para la lista actual de la tarjeta
    const taskTitleInput = document.getElementById('taskTitle');
    const taskDescriptionInput = document.getElementById('taskDescription');
    const taskAssignedInput = document.getElementById('taskAssigned');
    const taskPriorityInput = document.getElementById('taskPriority');
    const taskCommentsHistoryInput = document.getElementById('taskComments'); // Historial de comentarios
    const newCommentInput = document.getElementById('newComment'); // Nuevo comentario a añadir

    let draggedCard = null;
    let cardDataStore = {}; // Objeto para almacenar todas las tarjetas por listId

    // --- Funciones de Persistencia (LocalStorage - Básico) ---
    function loadCardsFromStorage() {
        const storedCards = localStorage.getItem('kanbanBoardCards');
        if (storedCards) {
            cardDataStore = JSON.parse(storedCards);
            for (const listId in cardDataStore) {
                cardDataStore[listId].forEach(cardData => {
                    renderCard(listId, cardData);
                });
            }
            updateAllWipLimits();
        } else {
            // Cargar datos de ejemplo si no hay nada en el storage
            loadSampleData();
        }
    }

    function saveCardsToStorage() {
        localStorage.setItem('kanbanBoardCards', JSON.stringify(cardDataStore));
    }

    function loadSampleData() {
        cardDataStore = {
            'backlog': [
                { id: 'card-1', title: 'Diseñar interfaz de usuario para módulo de reportes', description: 'Crear wireframes y mockups de alta fidelidad.', assigned: 'Diseño', priority: 'Alta', comments: [{ timestamp: new Date().toLocaleString(), comment: 'Tarea inicial.' }] },
                { id: 'card-2', title: 'Investigar nuevas fuentes de datos para el dashboard', description: 'Explorar APIs de redes sociales para métricas de engagement.', assigned: 'Datos', priority: 'Media', comments: [{ timestamp: new Date().toLocaleString(), comment: 'Inicio de la investigación.' }] }
            ],
            'wip': [
                { id: 'card-3', title: 'Desarrollar módulo de autenticación de usuarios', description: 'Implementar login/logout y gestión de sesiones.', assigned: 'Código', priority: 'Crítica', comments: [{ timestamp: new Date().toLocaleString(), comment: 'Iniciado el desarrollo de la API de autenticación.' }] }
            ],
            'review': [],
            'done': [
                { id: 'card-4', title: 'Revisión final de propuesta comercial', description: 'Documento de propuesta para el cliente X.', assigned: 'Contacto', priority: 'Alta', comments: [{ timestamp: new Date().toLocaleString(), comment: 'Documento enviado a revisión el 01/07.' }, { timestamp: new Date().toLocaleString(), comment: 'Aprobado por gerencia. Listo para enviar al cliente.' }] }
            ]
        };
        saveCardsToStorage();
        loadCardsFromStorage(); // Renderizar las tarjetas de ejemplo
    }


    // --- Funciones de Renderizado y Gestión de Tarjetas ---

    function renderCard(listId, cardData) {
        const listCardsContainer = document.querySelector(`#list-${listId} .list-cards`);
        const cardElement = createCardElementHTML(cardData); // Crea el HTML de la tarjeta
        listCardsContainer.appendChild(cardElement);
        updateWipLimitDisplay(listId);
    }

    function createCardElementHTML(cardData) {
        const card = document.createElement('div');
        card.classList.add('kanban-card');
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-id', cardData.id);

        card.innerHTML = `
            <h3>
                ${cardData.title}
                <button class="delete-card-btn" data-id="${cardData.id}">X</button>
            </h3>
            <p>${cardData.description || ''}</p>
            <div class="card-meta">
                <span>Asignado: <span class="assigned-person">${cardData.assigned || 'N/A'}</span></span>
                <span>Prioridad: ${cardData.priority || 'N/A'}</span>
            </div>
        `;

        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-card-btn')) { // Evitar abrir modal si se hace clic en eliminar
                openModalForEdit(cardData, card.closest('.kanban-list').id.replace('list-', ''));
            }
        });
        card.querySelector('.delete-card-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Previene que se dispare el evento de click de la tarjeta
            if (confirm('¿Estás seguro de que quieres eliminar esta tarea? Esta acción es irreversible.')) {
                deleteCard(cardData.id);
            }
        });
        return card;
    }

    function deleteCard(cardId) {
        let found = false;
        for (const listId in cardDataStore) {
            const initialCount = cardDataStore[listId].length;
            cardDataStore[listId] = cardDataStore[listId].filter(c => c.id !== cardId);
            if (cardDataStore[listId].length < initialCount) {
                // Tarjeta encontrada y eliminada del store
                const cardElement = document.querySelector(`.kanban-card[data-id="${cardId}"]`);
                if (cardElement) {
                    cardElement.remove(); // Eliminar del DOM
                }
                updateWipLimitDisplay(listId); // Actualizar el límite de la lista
                found = true;
                break;
            }
        }
        if (found) {
            saveCardsToStorage();
        } else {
            console.warn(`Tarjeta con ID ${cardId} no encontrada para eliminar.`);
        }
    }


    // --- Lógica de Drag & Drop ---

    function handleDragStart(e) {
        draggedCard = e.target;
        e.dataTransfer.setData('cardId', e.target.dataset.id);
        e.dataTransfer.setData('originalListId', e.target.closest('.kanban-list').id.replace('list-', ''));
        setTimeout(() => {
            e.target.classList.add('dragging');
        }, 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        draggedCard = null;
        lists.forEach(list => list.classList.remove('drag-over'));
    }

    lists.forEach(list => {
        const listCardsContainer = list.querySelector('.list-cards');

        listCardsContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetListId = list.id.replace('list-', '');
            const cardId = e.dataTransfer.getData('cardId');
            const cardElement = document.querySelector(`.kanban-card[data-id="${cardId}"]`);

            if (cardElement && isDropAllowed(targetListId, cardElement)) {
                 list.classList.add('drag-over');
            } else {
                list.classList.remove('drag-over'); // No permitir el drag-over visual si no se puede soltar
            }
        });

        listCardsContainer.addEventListener('dragleave', () => {
            list.classList.remove('drag-over');
        });

        listCardsContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            list.classList.remove('drag-over');

            const cardId = e.dataTransfer.getData('cardId');
            const originalListId = e.dataTransfer.getData('originalListId');
            const cardElement = document.querySelector(`.kanban-card[data-id="${cardId}"]`);
            const targetListId = list.id.replace('list-', '');

            if (cardElement && isDropAllowed(targetListId, cardElement)) {
                // Remover la tarjeta del DOM de la lista original
                cardElement.remove();

                // Recuperar los datos de la tarjeta del store
                let cardData = null;
                if (cardDataStore[originalListId]) {
                    cardData = cardDataStore[originalListId].find(c => c.id === cardId);
                }

                if (cardData) {
                    // Abrir modal para que el usuario añada información
                    openModalForEdit(cardData, targetListId, true); // true para indicar que es un movimiento
                } else {
                    alert('Error: No se pudo encontrar los datos de la tarjeta. Recarga la página.');
                }
            } else if (cardElement) {
                alert('No se puede mover la tarjeta: Límite de trabajo en curso (WIP) alcanzado o movimiento no permitido.');
            }
        });
    });


    // --- Lógica de Límite WIP ---

    function updateWipLimitDisplay(listId) {
        const listElement = document.getElementById(`list-${listId}`);
        if (!listElement) return;

        const wipLimitSpan = listElement.querySelector('.wip-limit');
        const limit = parseInt(wipLimitSpan.dataset.limit);

        if (!isNaN(limit)) {
            const currentCards = listElement.querySelectorAll('.kanban-card').length;
            wipLimitSpan.textContent = `${currentCards}/${limit}`;
            if (currentCards > limit) {
                listElement.classList.add('wip-exceeded');
            } else {
                listElement.classList.remove('wip-exceeded');
            }
        } else {
            wipLimitSpan.textContent = '∞';
        }
    }

    function updateAllWipLimits() {
        lists.forEach(list => updateWipLimitDisplay(list.id.replace('list-', '')));
    }

    function isDropAllowed(targetListId, cardElement) {
        const targetList = document.getElementById(`list-${targetListId}`);
        const wipLimitSpan = targetList.querySelector('.wip-limit');
        const limit = parseInt(wipLimitSpan.dataset.limit);

        if (isNaN(limit)) {
            return true; // No hay límite, se permite
        }

        const currentCardsInTarget = targetList.querySelectorAll('.kanban-card').length;
        const originalListId = cardElement.closest('.kanban-list').id.replace('list-', '');

        // Si se mueve dentro de la misma lista, siempre se permite (para reordenar)
        if (originalListId === targetListId) {
            return true;
        }

        // Si la lista de destino es el límite WIP
        return currentCardsInTarget < limit;
    }


    // --- Funciones del Modal (Añadir/Editar/Mover) ---

    // cardData: objeto con los datos de la tarjeta
    // listId: ID de la lista donde la tarjeta debería terminar (o está)
    // isMovement: booleano, true si el modal se abre por un drag&drop
    function openModalForEdit(cardData, targetListId, isMovement = false) {
        modal.style.display = 'flex';
        modalTitle.textContent = isMovement ? 'Tarea Movida - Actualiza Información' : 'Editar Tarea';

        taskIdInput.value = cardData.id;
        currentListIdInput.value = targetListId; // Establece la lista de destino o la lista actual

        taskTitleInput.value = cardData.title;
        taskDescriptionInput.value = cardData.description || '';
        taskAssignedInput.value = cardData.assigned || '';
        taskPriorityInput.value = cardData.priority || '';

        // Mostrar historial de comentarios
        taskCommentsHistoryInput.value = (cardData.comments || []).map(c => `[${c.timestamp}] ${c.comment}`).join('\n');

        // Resetear y enfocar el campo de nuevo comentario
        newCommentInput.value = isMovement ? `Movida a "${document.getElementById(`list-${targetListId}`).querySelector('h2').textContent.trim()}".` : '';
        newCommentInput.focus();
    }

    function openModalForAdd(listId) {
        modal.style.display = 'flex';
        modalTitle.textContent = 'Añadir Nueva Tarea';
        taskIdInput.value = ''; // Limpiar ID para añadir
        currentListIdInput.value = listId; // Establecer la lista donde se añadirá

        taskTitleInput.value = '';
        taskDescriptionInput.value = '';
        taskAssignedInput.value = '';
        taskPriorityInput.value = '';
        taskCommentsHistoryInput.value = ''; // Sin historial
        newCommentInput.value = ''; // Nuevo comentario vacío
        taskTitleInput.focus(); // Enfocar el título para empezar a escribir
    }

    function closeModal() {
        modal.style.display = 'none';
        taskForm.reset(); // Limpiar el formulario
    }

    // --- Event Listeners para el Modal ---
    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cardId = taskIdInput.value || `card-${Date.now()}`;
        const targetListId = currentListIdInput.value;
        const newCommentText = newCommentInput.value.trim();

        // Obtener datos existentes de la tarjeta o crear una nueva estructura
        let cardData = null;
        let originalListId = null;

        // Si es una tarjeta existente, buscarla en el store
        if (taskIdInput.value) {
            for (const list in cardDataStore) {
                const foundCard = cardDataStore[list].find(c => c.id === cardId);
                if (foundCard) {
                    cardData = { ...foundCard }; // Clonar para modificar
                    originalListId = list;
                    break;
                }
            }
        }

        // Si no se encontró o es nueva, inicializar
        if (!cardData) {
            cardData = {
                id: cardId,
                comments: []
            };
        }

        // Actualizar los campos principales
        cardData.title = taskTitleInput.value;
        cardData.description = taskDescriptionInput.value;
        cardData.assigned = taskAssignedInput.value;
        cardData.priority = taskPriorityInput.value;

        // Añadir el nuevo comentario al historial
        if (newCommentText) {
            cardData.comments.push({
                timestamp: new Date().toLocaleString(),
                comment: newCommentText
            });
        }

        // --- Lógica para mover y guardar en el store ---
        if (originalListId && originalListId !== targetListId) {
            // Eliminar de la lista original en el store
            cardDataStore[originalListId] = cardDataStore[originalListId].filter(c => c.id !== cardId);
        }

        // Añadir/Actualizar en la lista de destino en el store
        if (!cardDataStore[targetListId]) {
            cardDataStore[targetListId] = [];
        }
        // Si ya existe en la lista de destino (ej. edición sin movimiento), actualizarla
        const existingIndexInTarget = cardDataStore[targetListId].findIndex(c => c.id === cardId);
        if (existingIndexInTarget !== -1) {
            cardDataStore[targetListId][existingIndexInTarget] = cardData;
        } else {
            cardDataStore[targetListId].push(cardData); // Si no existe, añadirla
        }

        // Re-renderizar la tarjeta en la nueva/misma lista
        const existingCardElement = document.querySelector(`.kanban-card[data-id="${cardId}"]`);
        if (existingCardElement) {
            existingCardElement.remove(); // Eliminar la versión antigua del DOM
        }
        renderCard(targetListId, cardData); // Renderizar la versión actualizada

        updateAllWipLimits();
        saveCardsToStorage();
        closeModal();
    });

    // --- Event Listeners Iniciales ---
    addCardButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const listId = e.target.dataset.listId;
            openModalForAdd(listId);
        });
    });

    // Cargar tarjetas al iniciar la página
    loadCardsFromStorage();
});