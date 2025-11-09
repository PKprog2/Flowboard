/* app.js
   Cleaned and fixed version of the uploaded script.
   Keeps original features: multiple boards, lists, cards, drag/drop, palettes, stock images, opacity, settings.
*/

const STORAGE_KEY = 'simple_board_v2';

// Undo history stack
const undoHistory = [];
const MAX_UNDO_HISTORY = 50;

function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function pushUndoState() {
    // Deep clone the current data state
    const currentState = JSON.stringify(data);
    undoHistory.push(currentState);
    if(undoHistory.length > MAX_UNDO_HISTORY) {
        undoHistory.shift();
    }
    updateUndoButton();
}

function undo() {
    if(undoHistory.length === 0) return;
    const prevState = undoHistory.pop();
    data = JSON.parse(prevState);
    saveData();
    render();
    updateUndoButton();
}

function updateUndoButton() {
    const undoBtn = document.getElementById('undo-btn');
    if(undoBtn) {
        undoBtn.disabled = undoHistory.length === 0;
        undoBtn.title = undoHistory.length > 0 ? `Undo (${undoHistory.length} actions)` : 'Nothing to undo';
    }
}

// Modern modal input replacement for prompt()
function showInputModal(title, placeholder = '', defaultValue = ''){
    return new Promise((resolve) => {
        const modal = document.getElementById('input-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const modalSubmit = document.getElementById('modal-submit');
        const modalCancel = document.getElementById('modal-cancel');
        
        if(!modal || !modalTitle || !modalInput || !modalSubmit || !modalCancel) {
            resolve(prompt(title, defaultValue)); // fallback
            return;
        }
        
        modalTitle.textContent = title;
        modalInput.placeholder = placeholder;
        modalInput.value = defaultValue;
        modalInput.type = 'text';
        modalInput.style.display = 'block';
        modal.classList.remove('hidden');
        
        setTimeout(() => {
            modalInput.focus();
            modalInput.select();
        }, 100);
        
        const cleanup = () => {
            modal.classList.add('hidden');
            modalSubmit.onclick = null;
            modalCancel.onclick = null;
            modalInput.onkeydown = null;
            modal.onclick = null;
        };
        
        modalSubmit.onclick = () => {
            const val = modalInput.value.trim();
            cleanup();
            resolve(val || null);
        };
        
        modalCancel.onclick = () => {
            cleanup();
            resolve(null);
        };
        
        modalInput.onkeydown = (e) => {
            if(e.key === 'Enter'){
                e.preventDefault();
                const val = modalInput.value.trim();
                cleanup();
                resolve(val || null);
            } else if(e.key === 'Escape'){
                cleanup();
                resolve(null);
            }
        };
        
        // Click outside to close
        modal.onclick = (e) => {
            if(e.target === modal){
                cleanup();
                resolve(null);
            }
        };
    });
}

// Modern confirm modal replacement for confirm()
function showConfirmModal(title, message){
    return new Promise((resolve) => {
        const modal = document.getElementById('input-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalInput = document.getElementById('modal-input');
        const modalSubmit = document.getElementById('modal-submit');
        const modalCancel = document.getElementById('modal-cancel');
        
        if(!modal || !modalTitle || !modalInput || !modalSubmit || !modalCancel) {
            resolve(confirm(title)); // fallback
            return;
        }
        
        modalTitle.textContent = title;
        modalInput.type = 'text';
        modalInput.style.display = 'none';
        modalInput.value = message;
        modal.classList.remove('hidden');
        
        // Show message as text
        const modalBody = modalInput.parentElement;
        const messageEl = document.createElement('p');
        messageEl.textContent = message;
        messageEl.style.cssText = 'margin:0;color:#5e6c84;font-size:15px;line-height:1.6';
        modalBody.insertBefore(messageEl, modalInput);
        
        modalSubmit.textContent = 'Confirm';
        modalCancel.textContent = 'Cancel';
        
        const cleanup = () => {
            modal.classList.add('hidden');
            modalSubmit.onclick = null;
            modalCancel.onclick = null;
            modal.onclick = null;
            messageEl.remove();
            modalSubmit.textContent = 'Confirm';
            modalInput.style.display = 'block';
        };
        
        modalSubmit.onclick = () => {
            cleanup();
            resolve(true);
        };
        
        modalCancel.onclick = () => {
            cleanup();
            resolve(false);
        };
        
        modal.onclick = (e) => {
            if(e.target === modal){
                cleanup();
                resolve(false);
            }
        };
    });
}

const defaultBoard = {
    id: genId(),
    title: 'Default Board',
    bgImage: 'https://images.unsplash.com/photo-1439405326854-014607f694d7?w=1200&q=80&auto=format&fit=crop',
    lists: [
        { id: genId(), title: 'To-do', cards: [] },
        { id: genId(), title: 'In Progress', cards: [] },
        { id: genId(), title: 'Done', cards: [] }
    ]
};

function saveData(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){ console.warn('saveData failed', e); } }
function loadData(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){ return null; } }

// load or initialize
let data = loadData();
if(!data){
    data = { boards: [defaultBoard], activeBoardId: defaultBoard.id };
} else {
    if(!Array.isArray(data.boards) || data.boards.length === 0){
        data.boards = [defaultBoard];
    }
    if(!data.activeBoardId || !data.boards.find(b => b.id === data.activeBoardId)){
        const found = data.boards.find(b => b.title === defaultBoard.title);
        data.activeBoardId = (found && found.id) || data.boards[0].id;
    }
}

// ensure listOpacity default
data.boards.forEach(b=>{ if(typeof b.listOpacity === 'undefined') b.listOpacity = 0.4; });

// DOM element references (guarded)
const boardEl = document.getElementById('board');
const clearBtn = document.getElementById('clear');
const tabsBar = document.getElementById('tabs-bar');
const settingsBtn = document.getElementById('settings');
const settingsMenu = document.getElementById('settings-menu');
const bgColorInput = document.getElementById('bg-color');
const settingsClose = document.getElementById('settings-close');
const bgUpload = document.getElementById('bg-upload');
const stockList = document.getElementById('stock-list');
const clearBgBtn = document.getElementById('clear-bg');
const listOpacityInput = document.getElementById('list-opacity');
const listOpacityVal = document.getElementById('list-opacity-val');

function getActiveBoard(){ return data.boards.find(b=>b.id===data.activeBoardId) || data.boards[0]; }

// Render board tabs
// Function to make a tab title editable
function makeTabTitleEditable(titleSpan, board, tab, originalOnClick) {
    console.log('makeTabTitleEditable called for:', board.title);
    console.log('titleSpan:', titleSpan);
    console.log('tab:', tab);
    
    // Store and disable the tab's click handler
    tab.onclick = null;
    
    // Replace span with input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-title-input';
    input.value = board.title;
    
    console.log('Input created:', input);
    console.log('About to replace span with input');
    
    titleSpan.replaceWith(input);
    
    console.log('Input should be in DOM now');
    
    // Focus after a tiny delay to ensure it's in the DOM
    setTimeout(() => {
        console.log('Attempting to focus input');
        input.focus();
        input.select();
        console.log('Input focused and selected');
    }, 10);
    
    let isEditing = true;
    const finishEdit = () => {
        if(!isEditing) return;
        isEditing = false;
        
        let newTitle = input.value.trim();
        newTitle = newTitle.replace(/\s+/g, ' ');
        if(!newTitle) newTitle = board.title;
        
        board.title = newTitle;
        
        // Replace input back with span and re-attach handler
        const span = document.createElement('span');
        span.className = 'tab-title';
        span.textContent = newTitle;
        span.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Double-click after edit on:', board.title);
            makeTabTitleEditable(span, board, tab, tab.onclick);
        });
        input.replaceWith(span);
        
        // Re-enable tab click and save
        tab.onclick = originalOnClick;
        saveData();
    };
    
    input.onblur = () => {
        setTimeout(finishEdit, 50);
    };
    
    input.onkeydown = (e) => {
        e.stopPropagation();
        if(e.key === 'Enter') {
            e.preventDefault();
            finishEdit();
        } else if(e.key === 'Escape') {
            e.preventDefault();
            isEditing = false;
            const span = document.createElement('span');
            span.className = 'tab-title';
            span.textContent = board.title;
            span.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Double-click after cancel on:', board.title);
                makeTabTitleEditable(span, board, tab, tab.onclick);
            });
            input.replaceWith(span);
            tab.onclick = originalOnClick;
        }
    };
    
    input.onclick = (e) => {
        e.stopPropagation();
    };
    
    input.onmousedown = (e) => {
        e.stopPropagation();
    };
}

function renderBoardTabs(){
    if(!tabsBar) return;
    tabsBar.innerHTML = '';
    
    data.boards.forEach(board => {
        const tab = document.createElement('button');
        tab.className = 'tab' + (board.id === data.activeBoardId ? ' active' : '');
        tab.dataset.boardId = board.id;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = board.title;
        
        // Will be set after tab.onclick is defined
        let tabClickHandler = null;
        
        // Double-click to edit board name
        titleSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Double-click detected on:', board.title);
            makeTabTitleEditable(titleSpan, board, tab, tabClickHandler);
        });
        
        tab.appendChild(titleSpan);
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = async (e) => {
            e.stopPropagation();
            if(data.boards.length === 1) {
                alert('Cannot delete the last board');
                return;
            }
            const confirmed = await showConfirmModal('Delete Board?', `Are you sure you want to delete "${board.title}"?`);
            if(confirmed) {
                data.boards = data.boards.filter(b => b.id !== board.id);
                if(data.activeBoardId === board.id) {
                    data.activeBoardId = data.boards[0].id;
                }
                saveRender();
            }
        };
        tab.appendChild(closeBtn);
        
        tabClickHandler = () => {
            data.activeBoardId = board.id;
            saveRender();
        };
        tab.onclick = tabClickHandler;
        
        tabsBar.appendChild(tab);
    });
    
    // Add "+" button
    const addTab = document.createElement('button');
    addTab.className = 'tab-add';
    addTab.innerHTML = '+ New Board';
    addTab.onclick = () => {
        // Create new board immediately with default lists and switch to it
        const nb = { 
            id: genId(), 
            title: 'Untitled Board', 
            bg: '#f4f7fb', 
            lists: [
                { id: genId(), title: 'To-do', cards: [] },
                { id: genId(), title: 'In Progress', cards: [] },
                { id: genId(), title: 'Done', cards: [] }
            ]
        };
        data.boards.push(nb);
        data.activeBoardId = nb.id;
        saveData();
        
        // Re-render to show the new board
        renderBoardTabs();
        render();
        
        // Find the newly created tab and trigger inline edit with input field
        setTimeout(() => {
            const newTab = document.querySelector(`.tab[data-board-id="${nb.id}"]`);
            if(newTab) {
                const titleSpan = newTab.querySelector('.tab-title');
                if(titleSpan) {
                    // Store and disable the tab's click handler
                    const originalOnClick = newTab.onclick;
                    newTab.onclick = null;
                    
                    // Replace span with input field
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'tab-title-input';
                    input.value = 'Untitled Board';
                    
                    titleSpan.replaceWith(input);
                    
                    // Focus after a tiny delay to ensure it's in the DOM
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 10);
                    
                    let isEditing = true;
                    const finishEdit = () => {
                        if(!isEditing) return;
                        isEditing = false;
                        
                        let newTitle = input.value.trim();
                        newTitle = newTitle.replace(/\s+/g, ' ');
                        if(!newTitle) newTitle = 'Untitled Board';
                        
                        nb.title = newTitle;
                        
                        // Replace input back with span
                        const span = document.createElement('span');
                        span.className = 'tab-title';
                        span.textContent = newTitle;
                        input.replaceWith(span);
                        
                        // Re-enable tab click and save
                        newTab.onclick = originalOnClick;
                        saveData();
                    };
                    
                    input.onblur = () => {
                        setTimeout(finishEdit, 50);
                    };
                    
                    input.onkeydown = (e) => {
                        e.stopPropagation();
                        if(e.key === 'Enter') {
                            e.preventDefault();
                            finishEdit();
                        } else if(e.key === 'Escape') {
                            e.preventDefault();
                            isEditing = false;
                            const span = document.createElement('span');
                            span.className = 'tab-title';
                            span.textContent = nb.title;
                            input.replaceWith(span);
                            newTab.onclick = originalOnClick;
                        }
                    };
                    
                    input.onclick = (e) => {
                        e.stopPropagation();
                    };
                    
                    input.onmousedown = (e) => {
                        e.stopPropagation();
                    };
                }
            }
        }, 100);
    };
    tabsBar.appendChild(addTab);
}

function formatDate(iso){
    if(!iso) return '';
    try {
        const d = new Date(iso);
        if(isNaN(d)) return iso;
        return d.toLocaleDateString();
    } catch(e){ return iso; }
}

function hexToRgba(hex, alpha = 1){
    if(!hex) return `rgba(235,236,240,${alpha})`;
    hex = hex.replace('#','').trim();
    if(hex.length === 3) hex = hex.split('').map(h=>h+h).join('');
    const intVal = parseInt(hex,16);
    const r = (intVal >> 16) & 255;
    const g = (intVal >> 8) & 255;
    const b = intVal & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}

// Render & save helper (missing previously)
function saveRender(){ saveData(); render(); }

// render board list selector
function renderBoardSelector(){
    if(!boardSelect) return;
    boardSelect.innerHTML = '';
    data.boards.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.title;
        if(b.id === data.activeBoardId) opt.selected = true;
        boardSelect.appendChild(opt);
    });
}

// stock images fallback list
const STOCK_IMAGES = [
    'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1200&q=80&auto=format&fit=crop', // Calm ocean water
    'https://images.unsplash.com/photo-1439405326854-014607f694d7?w=1200&q=80&auto=format&fit=crop', // Ocean waves
    'https://images.unsplash.com/photo-1484821582734-6c6c9f99a672?w=1200&q=80&auto=format&fit=crop', // Turquoise water
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=80&auto=format&fit=crop'  // Clear blue water
];

// utility: spawn small fireworks (visual feedback) — safe-guarded
function spawnFireworks(x,y){
    try{
        for(let i=0;i<10;i++){
            const p = document.createElement('div');
            p.className = 'firework-particle';
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            const dx = (Math.random()-0.5) * 200 + 'px';
            const dy = (Math.random()-0.5) * 200 + 'px';
            p.style.setProperty('--dx', dx);
            p.style.setProperty('--dy', dy);
            document.body.appendChild(p);
            setTimeout(()=> p.remove(), 900);
        }
    }catch(e){}
}

let dragGhost = null;
let manualDrag = null;
let currentHoverListId = null;

function setHoverList(listId){
    if(currentHoverListId === listId) return;
    const prev = currentHoverListId && document.querySelector(`.list[data-list-id='${currentHoverListId}']`);
    if(prev) prev.classList.remove('list-hover');
    currentHoverListId = listId;
    if(listId){
        const el = document.querySelector(`.list[data-list-id='${listId}']`);
        if(el) el.classList.add('list-hover');
    }
}

function createDragGhost(cardEl){
    removeDragGhost();
    dragGhost = cardEl.cloneNode(true);
    dragGhost.classList.add('drag-ghost');
    if(cardEl.dataset && cardEl.dataset.cardId) dragGhost.dataset.cardId = cardEl.dataset.cardId;
    const r = cardEl.getBoundingClientRect();
    dragGhost.style.position = 'fixed';
    dragGhost.style.left = r.left + 'px';
    dragGhost.style.top = r.top + 'px';
    dragGhost.style.width = r.width + 'px';
    dragGhost.style.height = r.height + 'px';
    dragGhost.style.margin = '0';
    dragGhost.style.pointerEvents = 'none';
    dragGhost.style.zIndex = 9999;
    document.body.appendChild(dragGhost);
    cardEl.style.opacity = '0.35';
}

function moveDragGhost(clientX, clientY, grabOffsetX = null, grabOffsetY = null){
    if(!dragGhost) return;
    const w = dragGhost.offsetWidth;
    const h = dragGhost.offsetHeight;
    const offsetX = (typeof grabOffsetX === 'number') ? -grabOffsetX : -w/2;
    const offsetY = (typeof grabOffsetY === 'number') ? -grabOffsetY : -h/3;
    dragGhost.style.left = (clientX + offsetX) + 'px';
    dragGhost.style.top = (clientY + offsetY) + 'px';
}

function removeDragGhost(){
    if(dragGhost){
        const origId = dragGhost.dataset && dragGhost.dataset.cardId;
        if(origId){
            const orig = document.querySelector(`.card[data-card-id='${origId}']`);
            if(orig) orig.style.opacity = '';
        }
        dragGhost.remove();
        dragGhost = null;
    }
}

function elementAtPoint(x,y){
    return document.elementFromPoint(x,y);
}

function onDocumentDragOver(e){
    e.preventDefault();
    moveDragGhost(e.clientX, e.clientY);
    try{
        const el = elementAtPoint(e.clientX, e.clientY);
        const listEl = el && el.closest ? el.closest('.list') : null;
        setHoverList(listEl ? listEl.dataset.listId : null);
    }catch(e){}
}

function onDocumentPointerMove(e){
    if(!manualDrag || e.pointerId !== manualDrag.pointerId) return;
    moveDragGhost(e.clientX, e.clientY, manualDrag.offsetX, manualDrag.offsetY);
    try{
        const el = elementAtPoint(e.clientX, e.clientY);
        const listEl = el && el.closest ? el.closest('.list') : null;
        setHoverList(listEl ? listEl.dataset.listId : null);
    }catch(e){}
}

function onDocumentPointerUp(e){
    if(!manualDrag || e.pointerId !== manualDrag.pointerId) return;
    const destListId = currentHoverListId || (function(){
        const el = elementAtPoint(e.clientX, e.clientY);
        const listEl = el && el.closest ? el.closest('.list') : null;
        return listEl ? listEl.dataset.listId : null;
    })();
    if(destListId && destListId !== manualDrag.srcListId){
        moveCard(manualDrag.cardId, manualDrag.srcListId, destListId, null);
    }
    document.removeEventListener('pointermove', onDocumentPointerMove);
    document.removeEventListener('pointerup', onDocumentPointerUp);
    try{
        const orig = document.querySelector(`.card[data-card-id='${manualDrag.cardId}']`);
        if(orig) orig.releasePointerCapture(manualDrag.pointerId);
    }catch(e){}
    manualDrag = null;
    removeDragGhost();
    setHoverList(null);
}

// move card implementation
function moveCard(cardId, srcListId, destListId, targetCardId=null){
    const board = getActiveBoard();
    if(srcListId===destListId && !targetCardId){ return; }
    const src = board.lists.find(l=>l.id===srcListId);
    const dest = board.lists.find(l=>l.id===destListId);
    if(!src || !dest) return;
    const idx = src.cards.findIndex(c=>c.id===cardId);
    if(idx===-1) return;
    pushUndoState();
    const [card] = src.cards.splice(idx,1);
    if(targetCardId){
        const tIdx = dest.cards.findIndex(c=>c.id===targetCardId);
        if(tIdx===-1) dest.cards.push(card);
        else dest.cards.splice(tIdx, 0, card);
    } else {
        dest.cards.push(card);
    }
    saveRender();
}

function moveList(draggedListId, targetListId){
    const board = getActiveBoard();
    const isDone = l => l.title && l.title.toLowerCase() === 'done';
    const dragged = board.lists.find(l => l.id === draggedListId);
    if(!dragged) return;
    if(isDone(dragged)) return;
    pushUndoState();
    const remaining = board.lists.filter(l => l.id !== draggedListId);
    const doneIndex = remaining.findIndex(isDone);
    let insertIndex = remaining.findIndex(l => l.id === targetListId);
    if(insertIndex === -1) insertIndex = (doneIndex === -1) ? remaining.length : doneIndex;
    else if(doneIndex !== -1 && insertIndex >= doneIndex) insertIndex = doneIndex;
    remaining.splice(insertIndex, 0, dragged);
    board.lists = remaining;
    saveRender();
}

// render function: constructs board DOM
function render(){
    renderBoardTabs();
    const board = getActiveBoard();
    
    // Update body background instead of board element
    if(board.bgImage){
        document.body.style.backgroundImage = `url('${board.bgImage}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
    } else if(board.bg && board.bg !== '#f4f7fb') {
        document.body.style.backgroundImage = 'none';
        document.body.style.background = board.bg;
    } else {
        document.body.style.backgroundImage = 'none';
        document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    // Find the categories container
    const container = document.querySelector('.categories-container');
    if(!container) return;
    
    container.innerHTML = '';

    const isDoneTitle = l => l.title && l.title.toLowerCase() === 'done';
    const otherLists = board.lists.filter(l => !isDoneTitle(l));
    const doneLists = board.lists.filter(isDoneTitle);
    const listsToRender = [...otherLists, ...doneLists];

    listsToRender.forEach(list => {
        const listEl = document.createElement('section');
        listEl.className = 'list' + (isDoneTitle(list) ? ' done-list' : '');
        listEl.dataset.listId = list.id;
        if(!isDoneTitle(list)) listEl.setAttribute('draggable','true');
        else listEl.removeAttribute('draggable');

        const bgColor = list.color || board.listDefaultColor || '#f8f9fa';
        const opacity = (typeof board.listOpacity === 'number') ? board.listOpacity : 0.95;
        listEl.style.backgroundColor = hexToRgba(bgColor, opacity);
        listEl.style.position = 'relative';

        const header = document.createElement('div'); header.className = 'list-header';
        const title = document.createElement('div'); title.className = 'list-title';
        
        // Don't allow editing "Done" list title
        const isDoneList = list.title.toLowerCase() === 'done';
        title.contentEditable = !isDoneList;
        title.innerText = list.title;
        
        if(!isDoneList) {
            title.addEventListener('blur', ()=> {
                list.title = title.innerText.trim() || 'Untitled';
                saveRender();
            });
            title.addEventListener('keydown', (e)=> { 
                if(e.key==='Enter'){ 
                    e.preventDefault(); 
                    title.blur(); 
                }
            });
        } else {
            // Add visual indication that it's not editable
            title.style.cursor = 'default';
            title.style.opacity = '0.9';
        }

        const del = document.createElement('button'); del.className = 'trash'; del.innerText='✕';
        del.title='Delete list';
        del.addEventListener('click', ()=> {
            if(confirm('Delete list and its cards?')) {
                pushUndoState();
                const board = getActiveBoard();
                const idx = board.lists.findIndex(l=>l.id===list.id);
                if(idx>-1){ board.lists.splice(idx,1); saveRender(); }
            }
        });

        const brushBtn = document.createElement('button');
        brushBtn.type = 'button';
        brushBtn.className = 'list-brush';
        brushBtn.title = 'Choose list color';
        brushBtn.innerHTML = '🖌';
        brushBtn.draggable = false;
        brushBtn.setAttribute('aria-haspopup', 'true');
        brushBtn.setAttribute('aria-expanded', 'false');
        brushBtn.setAttribute('aria-controls', 'palette-' + list.id);

        const palette = document.createElement('div');
        palette.className = 'color-palette hidden';
        palette.id = 'palette-' + list.id;
        palette.setAttribute('role', 'menu');
        palette.setAttribute('aria-hidden', 'true');
        palette.tabIndex = -1;

        const PRESET_COLORS = ['#ebecf0','#ffd166','#06d6a0','#ef476f','#118ab2'];
        PRESET_COLORS.forEach((c) => {
            const sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'color-swatch';
            sw.style.background = c;
            sw.title = c;
            sw.setAttribute('role', 'menuitem');
            sw.tabIndex = 0;
            sw.addEventListener('click', (ev)=> {
                list.color = c;
                listEl.style.backgroundColor = hexToRgba(c, board.listOpacity);
                saveRender();
                closeAllPalettes();
                brushBtn.focus();
            });
            sw.addEventListener('keydown', (ev) => {
                if(ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sw.click(); }
                if(ev.key === 'Escape') { closeAllPalettes(); brushBtn.focus(); }
            });
            palette.appendChild(sw);
        });

        const pickerWrap = document.createElement('div');
        pickerWrap.className = 'color-picker-wrap';
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.className = 'color-picker';
        picker.value = list.color || '#ebecf0';
        picker.title = 'Pick custom color';
        picker.setAttribute('role','menuitem');
        picker.addEventListener('input', (ev) => {
            ev.stopPropagation();
            const c = ev.target.value;
            list.color = c;
            listEl.style.backgroundColor = hexToRgba(c, board.listOpacity);
            saveRender();
        });
        picker.addEventListener('keydown', (ev) => {
            if(ev.key === 'Escape') { closeAllPalettes(); brushBtn.focus(); }
        });
        pickerWrap.appendChild(picker);
        palette.appendChild(pickerWrap);

        function openPalette() {
            closeAllPalettes();
            palette.classList.remove('hidden'); palette.classList.add('open');
            palette.setAttribute('aria-hidden','false'); brushBtn.setAttribute('aria-expanded','true');
            const first = palette.querySelector('.color-swatch, .color-picker');
            if(first) first.focus();
        }
        function closePalette() {
            palette.classList.add('hidden'); palette.classList.remove('open');
            palette.setAttribute('aria-hidden','true'); brushBtn.setAttribute('aria-expanded','false');
        }

        brushBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if(palette.classList.contains('open')) closePalette();
            else openPalette();
        });
        brushBtn.addEventListener('keydown', (ev) => {
            if(ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openPalette(); }
            if(ev.key === 'Escape') closePalette();
        });

        ['pointerdown','mousedown','touchstart'].forEach(n => brushBtn.addEventListener(n, e=> e.stopPropagation(), {passive:true}));
        palette.addEventListener('pointerdown', e => e.stopPropagation());

        header.appendChild(title);
        header.appendChild(del);
        header.appendChild(brushBtn);
        header.appendChild(palette);
        listEl.appendChild(header);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'cards';
        list.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card' + (card.completed ? ' completed' : '');
            cardEl.draggable = true;
            cardEl.dataset.cardId = card.id;
            cardEl.dataset.listId = list.id;

            const leftWrap = document.createElement('div');
            leftWrap.style.display = 'flex';
            leftWrap.style.alignItems = 'center';
            leftWrap.style.gap = '8px';
            leftWrap.style.flex = '1';

            // --- Clean SVG version of complete button ---
// --- Clean SVG version of complete button ---
const completeBtn = document.createElement('button');
completeBtn.type = 'button';
completeBtn.className = 'complete-btn' + (card.completed ? ' completed' : '');
completeBtn.title = card.completed ? 'Mark as incomplete' : 'Mark complete';
completeBtn.innerHTML = `
  <svg viewBox="0 0 24 24" class="check-icon" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" class="circle"/>
    <path d="M7 12l3 3 7-7" class="check" />
  </svg>
`;
completeBtn.draggable = false;

// --- working click behavior with fireworks + Done list ---
completeBtn.addEventListener('click', (ev) => {
  const board = getActiveBoard();
  if (!board) return;

  if (card.completed) {
    // un-complete
    card.completed = false;
    const prevId = card._prevListId;
    delete card._prevListId;
    let destList = board.lists.find(l => l.id === prevId);
    if (!destList)
      destList = board.lists.find(l => !(l.title && l.title.toLowerCase() === 'done'));
    if (destList) moveCard(card.id, list.id, destList.id, null);
    else saveRender();
  } else {
    // complete
    card._prevListId = list.id;
    card.completed = true;

    // Find or create Done list
    let doneList = board.lists.find(l => l.title && l.title.toLowerCase() === 'done');
    if (!doneList) {
      doneList = { id: genId(), title: 'Done', cards: [] };
      board.lists.push(doneList);
    }

    // move card, then show fireworks
    moveCard(card.id, list.id, doneList.id, null);
    saveRender();
    try {
      const r = cardEl.getBoundingClientRect();
      spawnFireworks(r.left + r.width / 2, r.top + r.height / 2);
    } catch (e) {}
  }
});


            const txtWrap = document.createElement('div');
            txtWrap.className = 'card-text';
            txtWrap.style.flex = '1';

            const nameEl = document.createElement('div');
            nameEl.className = 'card-name';
            nameEl.contentEditable = true;
            nameEl.innerText = card.name || '';
            nameEl.addEventListener('blur', ()=> {
                card.name = nameEl.innerText.trim();
                saveData();
            });
            nameEl.addEventListener('keydown', (e)=> { if(e.key==='Enter'){ e.preventDefault(); nameEl.blur(); }});

            const dueEl = document.createElement('div');
            dueEl.className = 'card-due muted';
            dueEl.innerText = card.due ? ('Due: ' + formatDate(card.due)) : '';

            txtWrap.appendChild(nameEl);
            txtWrap.appendChild(dueEl);

            leftWrap.appendChild(completeBtn);
            leftWrap.appendChild(txtWrap);

            const remove = document.createElement('button');
            remove.className='trash';
            remove.type = 'button';
            remove.innerText='🗑';
            remove.title='Delete card';
            remove.addEventListener('click', ()=> {
                pushUndoState();
                const board = getActiveBoard();
                const l = board.lists.find(x=>x.id===list.id);
                const idx = l.cards.findIndex(c=>c.id===card.id);
                if(idx>-1){ l.cards.splice(idx,1); saveRender(); }
            });

            cardEl.appendChild(leftWrap);
            cardEl.appendChild(remove);

            // drag events
            cardEl.addEventListener('dragstart', (ev)=> {
                if(ev.target && ev.target.closest && ev.target.closest('.complete-btn, input, textarea, button')) {
                    ev.preventDefault();
                    return;
                }
                try{
                    ev.dataTransfer.setData('text/cardId', card.id);
                    ev.dataTransfer.setData('text/srcListId', list.id);
                }catch(e){}
                createDragGhost(cardEl);
                document.addEventListener('dragover', onDocumentDragOver);
                requestAnimationFrame(()=> cardEl.classList.add('dragging'));
            });

            cardEl.addEventListener('dragend', (ev)=> {
                document.removeEventListener('dragover', onDocumentDragOver);
                try{
                    const destListId = currentHoverListId || (function(){
                        const x = ev.clientX || (ev.pageX - window.scrollX);
                        const y = ev.clientY || (ev.pageY - window.scrollY);
                        const el = elementAtPoint(x, y);
                        const listEl = el && el.closest ? el.closest('.list') : null;
                        return listEl ? listEl.dataset.listId : null;
                    })();
                    if(destListId && destListId !== list.id){
                        moveCard(card.id, list.id, destListId, null);
                    }
                }catch(e){}
                removeDragGhost();
                cardEl.classList.remove('dragging');
                setHoverList(null);
            });

            // pointer based manual drag
            cardEl.addEventListener('pointerdown', (ev)=> {
                if(ev.button && ev.button !== 0) return;
                const tgt = ev.target;
                if(tgt && (tgt.isContentEditable || (tgt.closest && tgt.closest('.complete-btn, input, textarea, button')))) {
                    return;
                }
                manualDrag = { cardId: card.id, srcListId: list.id, pointerId: ev.pointerId };
                const r = cardEl.getBoundingClientRect();
                manualDrag.offsetX = ev.clientX - r.left;
                manualDrag.offsetY = ev.clientY - r.top;
                createDragGhost(cardEl);
                moveDragGhost(ev.clientX, ev.clientY, manualDrag.offsetX, manualDrag.offsetY);
                try{ cardEl.setPointerCapture(ev.pointerId); }catch(e){}
                document.addEventListener('pointermove', onDocumentPointerMove);
                document.addEventListener('pointerup', onDocumentPointerUp);
                ev.preventDefault();
            });

            cardsContainer.appendChild(cardEl);
        });

        listEl.appendChild(cardsContainer);

        // add card UI (inline)
        const addWrap = document.createElement('div');
        addWrap.className = 'add-card';
        const addBtn = document.createElement('button');
        addBtn.className = 'small';
        addBtn.type = 'button';
        addBtn.innerText = 'Add Task';

        const form = document.createElement('div');
        form.className = 'add-form';
        form.style.display = 'none';

        const nameInput = document.createElement('input');
        nameInput.className = 'card-input';
        nameInput.type = 'text';
        nameInput.placeholder = 'Task name';

        const btnRow = document.createElement('div');
        btnRow.className = 'btn-row';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'small save';
        saveBtn.type = 'button';
        saveBtn.innerText = 'Add';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'small';
        cancelBtn.type = 'button';
        cancelBtn.innerText = 'Cancel';

        const addNewTask = () => {
            const name = nameInput.value.trim();
            if(!name){ nameInput.focus(); return; }
            const board = getActiveBoard();
            list.cards.push({ id: genId(), name, due: '' });
            nameInput.value = '';
            
            // Save and mark this list's form as active
            const listId = list.id;
            saveData();
            
            // Store that this form should stay open
            const wasOpen = true;
            render();
            
            // Re-open the form and focus it
            setTimeout(() => {
                const targetList = container.querySelector(`[data-list-id="${listId}"]`);
                if(targetList) {
                    const btn = targetList.querySelector('.add-card button.small:not(.save)');
                    const form = targetList.querySelector('.add-form');
                    const input = targetList.querySelector('.add-form input');
                    if(btn && form && input) {
                        btn.style.display = 'none';
                        form.style.display = '';
                        input.focus();
                    }
                }
            }, 0);
        };

        addBtn.addEventListener('click', ()=> {
            addBtn.style.display = 'none';
            form.style.display = '';
            nameInput.focus();
        });

        saveBtn.addEventListener('click', addNewTask);

        cancelBtn.addEventListener('click', ()=> {
            nameInput.value = '';
            form.style.display = 'none';
            addBtn.style.display = '';
        });

        nameInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter'){ 
                e.preventDefault(); 
                addNewTask();
            } else if(e.key === 'Escape'){ 
                e.preventDefault(); 
                cancelBtn.click(); 
            }
        });

        btnRow.appendChild(saveBtn);
        btnRow.appendChild(cancelBtn);
        form.appendChild(nameInput);
        form.appendChild(btnRow);

        addWrap.appendChild(addBtn);
        addWrap.appendChild(form);
        listEl.appendChild(addWrap);

        container.appendChild(listEl);
    });

    // Add "+ New List" button after all lists
    const addListSection = document.createElement('section');
    addListSection.className = 'add-list-section';
    addListSection.innerHTML = `
        <button type="button" class="add-list-btn" id="add-list-inline">
            <span class="add-icon">+</span>
            <span>New List</span>
        </button>
        <div class="add-list-form" style="display: none;">
            <input type="text" class="list-name-input" placeholder="Enter list name..." />
            <div class="add-list-actions">
                <button type="button" class="btn-save-list">Add List</button>
                <button type="button" class="btn-cancel-list">✕</button>
            </div>
        </div>
    `;
    container.appendChild(addListSection);

    // Set up inline list creation
    setupInlineListCreation(addListSection);

    // Set up list drag and drop on the container
    setupListDragAndDrop(container);

    // attach dragover to board (so native dragover still updates ghost)
    document.addEventListener('dragover', onDocumentDragOver, { passive: false });
    
    // Update undo button state
    updateUndoButton();
}

// List drag and drop implementation
function setupListDragAndDrop(container) {
    if(!container) return;
    
    let placeholder = null;
    
    const getListsExceptDone = () => {
        return Array.from(container.querySelectorAll('.list:not(.done-list)'));
    };
    
    const getInsertIndex = (clientX) => {
        const lists = getListsExceptDone().filter(l => !l.classList.contains('dragging'));
        
        for(let i = 0; i < lists.length; i++) {
            const rect = lists[i].getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            if(clientX < midpoint) {
                return i;
            }
        }
        return lists.length;
    };
    
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = container.querySelector('.list.dragging');
        if(!dragging) return;
        
        const insertIdx = getInsertIndex(e.clientX);
        const lists = getListsExceptDone();
        const ref = lists[insertIdx];
        
        if(ref && ref !== placeholder) {
            container.insertBefore(placeholder, ref);
        } else if(!ref) {
            // Insert before Done list if it exists, or at end
            const doneList = container.querySelector('.list.done-list');
            if(doneList) {
                container.insertBefore(placeholder, doneList);
            } else {
                container.appendChild(placeholder);
            }
        }
    });
    
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const dragging = container.querySelector('.list.dragging');
        if(!dragging || !placeholder) return;
        
        pushUndoState();
        
        // Insert dragged element where placeholder is
        container.insertBefore(dragging, placeholder);
        placeholder.remove();
        placeholder = null;
        
        dragging.classList.remove('dragging');
        
        // Update data model
        const board = getActiveBoard();
        const newOrder = [];
        container.querySelectorAll('.list').forEach(listEl => {
            const id = listEl.dataset.listId;
            const list = board.lists.find(l => l.id === id);
            if(list) newOrder.push(list);
        });
        board.lists = newOrder;
        saveData();
    });
    
    // Set up drag handlers on each list
    container.querySelectorAll('.list').forEach(listEl => {
        const isDone = listEl.classList.contains('done-list');
        if(isDone) return;
        
        listEl.addEventListener('dragstart', (e) => {
            // Prevent dragging from interactive elements
            if(e.target.closest('button, input, textarea, [contenteditable]')) {
                e.preventDefault();
                return;
            }
            
            listEl.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', listEl.dataset.listId);
            
            // Create placeholder
            setTimeout(() => {
                placeholder = document.createElement('div');
                placeholder.className = 'list-placeholder';
                placeholder.style.width = listEl.offsetWidth + 'px';
                placeholder.style.height = listEl.offsetHeight + 'px';
                placeholder.style.minWidth = listEl.offsetWidth + 'px';
                container.insertBefore(placeholder, listEl);
            }, 0);
        });
        
        listEl.addEventListener('dragend', (e) => {
            listEl.classList.remove('dragging');
            if(placeholder && placeholder.parentNode) {
                placeholder.remove();
            }
            placeholder = null;
        });
    });
}

// helper to close palettes
function closeAllPalettes(){
    document.querySelectorAll('.color-palette').forEach(p=>p.classList.add('hidden'));
}

// settings UI wiring
if(settingsBtn) settingsBtn.addEventListener('click', ()=> {
    const board = getActiveBoard();
    if(bgColorInput) bgColorInput.value = board.bg || '#f4f7fb';
    if(bgUpload) try{ bgUpload.value = ''; }catch(e){}
    renderStockThumbnails();
    if(listOpacityInput && typeof board.listOpacity !== 'undefined'){
        listOpacityInput.value = board.listOpacity;
        if(listOpacityVal) listOpacityVal.innerText = Math.round(board.listOpacity * 100) + '%';
    }
    const isHidden = settingsMenu.classList.toggle('hidden');
    settingsMenu.setAttribute('aria-hidden', isHidden);
});
document.addEventListener('click', (e) => {
    if(!settingsMenu) return;
    if(settingsMenu.classList.contains('hidden')) {
        closeAllPalettes();
        return;
    }
    if(settingsMenu.contains(e.target) || (settingsBtn && settingsBtn.contains(e.target))) return;
    settingsMenu.classList.add('hidden');
    settingsMenu.setAttribute('aria-hidden','true');
    closeAllPalettes();
});
document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
        if(settingsMenu && !settingsMenu.classList.contains('hidden')){
            settingsMenu.classList.add('hidden');
            settingsMenu.setAttribute('aria-hidden','true');
        }
        closeAllPalettes();
    }
});

if(bgColorInput) bgColorInput.addEventListener('input', (e)=> {
    const board = getActiveBoard();
    board.bg = e.target.value;
    saveRender();
});

// Inline list creation handler
function setupInlineListCreation(addListSection) {
    const addBtn = addListSection.querySelector('.add-list-btn');
    const form = addListSection.querySelector('.add-list-form');
    const input = addListSection.querySelector('.list-name-input');
    const saveBtn = addListSection.querySelector('.btn-save-list');
    const cancelBtn = addListSection.querySelector('.btn-cancel-list');

    addBtn.addEventListener('click', () => {
        addBtn.style.display = 'none';
        form.style.display = 'block';
        input.focus();
    });

    const saveList = () => {
        const title = input.value.trim();
        if(!title) {
            input.focus();
            return;
        }
        pushUndoState();
        const board = getActiveBoard();
        // Insert before Done list
        const doneIndex = board.lists.findIndex(l => l.title.toLowerCase() === 'done');
        if(doneIndex !== -1) {
            board.lists.splice(doneIndex, 0, {id: genId(), title, cards: []});
        } else {
            board.lists.push({id: genId(), title, cards: []});
        }
        input.value = '';
        saveRender();
    };

    const cancel = () => {
        input.value = '';
        form.style.display = 'none';
        addBtn.style.display = 'flex';
    };

    saveBtn.addEventListener('click', saveList);
    cancelBtn.addEventListener('click', cancel);

    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            saveList();
        } else if(e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    });
}

const undoBtn = document.getElementById('undo-btn');
if(undoBtn) undoBtn.addEventListener('click', ()=> {
    undo();
});

// Ctrl+Z / Cmd+Z keyboard shortcut
document.addEventListener('keydown', (e) => {
    if((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Don't undo if user is typing in an input
        if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        e.preventDefault();
        undo();
    }
});

if(clearBtn) clearBtn.addEventListener('click', async ()=> {
    const confirmed = await showConfirmModal('Clear Entire Board?', 'This will remove all lists and cards. This action cannot be undone.');
    if(confirmed) {
        pushUndoState();
        const board = getActiveBoard();
        board.lists = [];
        saveRender();
    }
});

function renderStockThumbnails(){
    if(!stockList) return;
    stockList.innerHTML = '';
    STOCK_IMAGES.forEach(src => {
        const btn = document.createElement('button');
        btn.className = 'stock-thumb';
        btn.style.backgroundImage = `url('${src}')`;
        btn.addEventListener('click', ()=> {
            const board = getActiveBoard();
            board.bgImage = src;
            saveRender();
        });
        stockList.appendChild(btn);
    });
}
if(clearBgBtn) clearBgBtn.addEventListener('click', ()=> {
    const board = getActiveBoard();
    delete board.bgImage;
    saveRender();
});
if(bgUpload) bgUpload.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
        const board = getActiveBoard();
        board.bgImage = reader.result;
        saveRender();
    };
    reader.readAsDataURL(f);
});

// Board tabs are now rendered in renderBoardTabs() function

if(settingsClose) settingsClose.addEventListener('click', ()=> {
    if(settingsMenu) { settingsMenu.classList.add('hidden'); settingsMenu.setAttribute('aria-hidden','true'); }
});

if(listOpacityInput) listOpacityInput.addEventListener('input', (e)=> {
    const v = parseFloat(e.target.value) || 0.4;
    const board = getActiveBoard();
    board.listOpacity = v;
    if(listOpacityVal) listOpacityVal.innerText = Math.round(v * 100) + '%';
    // apply to rendered lists by re-rendering
    saveRender();
});

// Drag & drop for lists (optional enhancements)
boardEl && boardEl.addEventListener('dragover', (ev)=> { ev.preventDefault(); });

// Setup initial UI and render
render();
