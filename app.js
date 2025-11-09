/* app.js
   Cleaned and fixed version of the uploaded script.
   Keeps original features: multiple boards, lists, cards, drag/drop, palettes, stock images, opacity, settings.
*/

import { getCurrentUser, saveBoards, loadBoards, signOut } from './db.js';

const STORAGE_KEY = 'simple_board_v2';
let currentUser = null;

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

async function saveData() { 
    try { 
        if (currentUser) {
            // Save to Supabase
            await saveBoards(currentUser.id, data);
        } else {
            // Fallback to localStorage (shouldn't happen if auth works)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); 
        }
    } catch(e) { 
        console.warn('saveData failed', e); 
    } 
}

function loadData(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e){ return null; } }

// Initialize data (will be replaced with Supabase data after auth check)
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
            // assign a random stock image as default background
            bgImage: (typeof STOCK_IMAGES !== 'undefined' && STOCK_IMAGES.length
                ? STOCK_IMAGES[Math.floor(Math.random()*STOCK_IMAGES.length)]
                : undefined),
            bg: '#f4f7fb', // fallback plain color if image cleared
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

// Inline date picker popup (small floating input)
function openInlineDatePicker(card, anchorEl){
    // Close any existing picker
    document.querySelectorAll('.date-pop').forEach(el => el.remove());
    const pop = document.createElement('div');
    pop.className = 'date-pop';
    const input = document.createElement('input');
    input.type = 'date';
    input.value = card.due || '';
    input.className = 'date-pop-input';
    const btnRow = document.createElement('div');
    btnRow.className = 'date-pop-buttons';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'date-pop-clear';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.className = 'date-pop-close';
    btnRow.appendChild(clearBtn);
    btnRow.appendChild(closeBtn);
    pop.appendChild(input);
    pop.appendChild(btnRow);
    document.body.appendChild(pop);
    // Position near anchor
    try {
        const r = anchorEl.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const scrollX = window.scrollX || document.documentElement.scrollLeft;
        pop.style.left = (r.left + scrollX) + 'px';
        pop.style.top = (r.bottom + scrollY + 4) + 'px';
    } catch(e) {}

    const close = () => { pop.remove(); document.removeEventListener('mousedown', onDocClick); };
    const onDocClick = (ev) => {
        if(!pop.contains(ev.target) && ev.target !== anchorEl){ close(); }
    };
    document.addEventListener('mousedown', onDocClick);

    input.addEventListener('change', () => {
        pushUndoState();
        card.due = input.value || '';
        saveRender();
        close();
    });
    // If there is a current value and user clicks outside without change, still close
    input.addEventListener('blur', () => {
        // timeout allows click on buttons to register
        setTimeout(() => { if(document.body.contains(pop)) close(); }, 120);
    });
    clearBtn.addEventListener('click', () => {
        pushUndoState();
        card.due = '';
        saveRender();
        close();
    });
    closeBtn.addEventListener('click', close);
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

// Open list settings menu (sort, delete, etc.)
function openListSettingsMenu(listId, buttonEl) {
    const board = getActiveBoard();
    const list = board.lists.find(l => l.id === listId);
    if(!list) return;

    // Remove any existing menu
    const existingMenu = document.querySelector('.list-settings-menu');
    if(existingMenu) existingMenu.remove();

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'list-settings-menu';

    // Position menu at button
    const rect = buttonEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';

    // Color picker section
    const colorSection = document.createElement('div');
    colorSection.className = 'list-settings-section';
    
    const colorLabel = document.createElement('div');
    colorLabel.className = 'list-settings-label';
    colorLabel.textContent = 'List Color';
    colorSection.appendChild(colorLabel);

    const colorSwatches = document.createElement('div');
    colorSwatches.className = 'color-swatches';
    const PRESET_COLORS = ['#ebecf0', '#ffd166', '#06d6a0', '#ef476f', '#118ab2', '#f8f9fa'];
    
    PRESET_COLORS.forEach((color) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-swatch-mini';
        swatch.style.backgroundColor = color;
        swatch.title = color;
        if(list.color === color) {
            swatch.classList.add('active');
        }
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            pushUndoState();
            list.color = color;
            const listEl = document.querySelector(`[data-list-id="${listId}"]`);
            if(listEl) {
                listEl.style.backgroundColor = hexToRgba(color, board.listOpacity || 0.95);
            }
            saveData();
            menu.remove();
        });
        colorSwatches.appendChild(swatch);
    });
    
    colorSection.appendChild(colorSwatches);
    menu.appendChild(colorSection);

    // Divider
    const divider1 = document.createElement('div');
    divider1.className = 'list-settings-divider';
    menu.appendChild(divider1);

    // Sort section
    const sortSection = document.createElement('div');
    sortSection.className = 'list-settings-section';
    
    const sortLabel = document.createElement('div');
    sortLabel.className = 'list-settings-label';
    sortLabel.textContent = 'Sort Cards';
    sortSection.appendChild(sortLabel);

    const sortAlpha = document.createElement('div');
    sortAlpha.className = 'list-settings-item';
    sortAlpha.innerHTML = '<span>📝</span> Sort A-Z';
    sortAlpha.addEventListener('click', () => {
        pushUndoState();
        list.cards.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        saveRender();
        menu.remove();
    });

    const sortDate = document.createElement('div');
    sortDate.className = 'list-settings-item';
    sortDate.innerHTML = '<span>📅</span> Sort by Date';
    sortDate.addEventListener('click', () => {
        pushUndoState();
        list.cards.sort((a, b) => {
            if(!a.due && !b.due) return 0;
            if(!a.due) return 1;
            if(!b.due) return -1;
            return a.due.localeCompare(b.due);
        });
        saveRender();
        menu.remove();
    });

    const sortPriority = document.createElement('div');
    sortPriority.className = 'list-settings-item';
    sortPriority.innerHTML = '<span>🚩</span> Sort by Priority';
    sortPriority.addEventListener('click', () => {
        const val = (p) => {
            switch(p){
                case 'high': return 3;
                case 'medium': return 2;
                case 'low': return 1;
                default: return 0;
            }
        };
        pushUndoState();
        list.cards.sort((a,b) => {
            const diff = val(b.priority) - val(a.priority); // high first
            if(diff !== 0) return diff;
            return (a.name || '').localeCompare(b.name || '');
        });
        saveRender();
        menu.remove();
    });

    sortSection.appendChild(sortAlpha);
    sortSection.appendChild(sortDate);
    sortSection.appendChild(sortPriority);
    menu.appendChild(sortSection);

    // Divider
    const divider2 = document.createElement('div');
    divider2.className = 'list-settings-divider';
    menu.appendChild(divider2);

    // Delete section
    const deleteList = document.createElement('div');
    deleteList.className = 'list-settings-item danger';
    deleteList.innerHTML = '<span>🗑️</span> Delete List';
    deleteList.addEventListener('click', () => {
        if(confirm('Delete list and all its cards?')) {
            pushUndoState();
            const idx = board.lists.findIndex(l => l.id === listId);
            if(idx > -1) {
                board.lists.splice(idx, 1);
                saveRender();
            }
        }
        menu.remove();
    });
    menu.appendChild(deleteList);

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e) => {
        if(!menu.contains(e.target) && e.target !== buttonEl) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
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
    const leftSpacer = document.createElement('div'); leftSpacer.className = 'list-header-spacer';
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

        // Inline delete button removed (functionality now lives in list settings menu)

    // Settings button (3-dot menu)
        const settingsBtn = document.createElement('button');
        settingsBtn.type = 'button';
        settingsBtn.className = 'list-settings-btn';
        settingsBtn.title = 'List settings';
        settingsBtn.innerHTML = '⋮';
        settingsBtn.draggable = false;
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openListSettingsMenu(list.id, settingsBtn);
        });

    header.appendChild(leftSpacer);
    header.appendChild(title);
    header.appendChild(settingsBtn);
        listEl.appendChild(header);

        // Resize handles (left and right edges)
        const resizeLeft = document.createElement('div');
        resizeLeft.className = 'resize-handle resize-left';
        resizeLeft.dataset.side = 'left';

        const resizeRight = document.createElement('div');
        resizeRight.className = 'resize-handle resize-right';
        resizeRight.dataset.side = 'right';

        listEl.appendChild(resizeLeft);
        listEl.appendChild(resizeRight);

        // Add resize functionality
        [resizeLeft, resizeRight].forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startWidth = listEl.offsetWidth;
                listEl.classList.add('resizing');

                const onMouseMove = (moveE) => {
                    const delta = moveE.clientX - startX;
                    const newWidth = Math.max(250, Math.min(600, startWidth + delta));
                    listEl.style.width = newWidth + 'px';
                    list.width = newWidth; // Save to data
                };

                const onMouseUp = () => {
                    listEl.classList.remove('resizing');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    saveData();
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });

        // Apply saved width
        if(list.width) {
            listEl.style.width = list.width + 'px';
        }

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'cards';
        list.cards.forEach(card => {
            // Backward compatibility: migrate old 'important' boolean to priority
            if(card.important && !card.priority){ card.priority = 'high'; }
            const cardEl = document.createElement('div');
            cardEl.className = 'card' + (card.completed ? ' completed' : '') + (card.due ? ' has-due' : '');
            cardEl.draggable = true;
            cardEl.dataset.cardId = card.id;
            cardEl.dataset.listId = list.id;

            // === Card hover controls (EasyNotes style) ===
            const cardHead = document.createElement('div');
            cardHead.className = 'card-head';

            // Left hover controls: date picker and importance flag
            const cardHeadLeft = document.createElement('div');
            cardHeadLeft.className = 'card-head-left';

            // Date picker button (calendar icon)
            const dateBtn = document.createElement('button');
            dateBtn.type = 'button';
            dateBtn.className = 'icon-btn date-btn';
            dateBtn.title = 'Set due date';
            dateBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>`;
            dateBtn.draggable = false;
            dateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openInlineDatePicker(card, dateBtn);
            });

            // Priority flag button (cycles: none -> low -> medium -> high -> none)
            const flagBtn = document.createElement('button');
            flagBtn.type = 'button';
            flagBtn.className = 'icon-btn flag-btn';
            flagBtn.title = 'Set priority';
            flagBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>
            </svg>`;
            flagBtn.draggable = false;
            const applyPriorityColor = () => {
                const map = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
                flagBtn.style.color = map[card.priority] || '#5a6278';
            };
            applyPriorityColor();
            flagBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                pushUndoState();
                const order = [null, 'low', 'medium', 'high'];
                const idx = order.indexOf(card.priority || null);
                const next = order[(idx + 1) % order.length];
                card.priority = next;
                saveRender();
            });

            cardHeadLeft.appendChild(dateBtn);
            cardHeadLeft.appendChild(flagBtn);

            // Right hover controls: complete and delete
            const cardHeadRight = document.createElement('div');
            cardHeadRight.className = 'card-head-right';

            // Complete button (checkmark icon)
            const completeBtn = document.createElement('button');
            completeBtn.type = 'button';
            completeBtn.className = 'icon-btn complete-btn';
            completeBtn.title = card.completed ? 'Mark as incomplete' : 'Mark complete';
            completeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
            </svg>`;
            completeBtn.draggable = false;
            completeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
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

            // Delete button (trash icon)
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'icon-btn delete-btn';
            deleteBtn.title = 'Delete card';
            deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>`;
            deleteBtn.draggable = false;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                pushUndoState();
                const board = getActiveBoard();
                const l = board.lists.find(x => x.id === list.id);
                const idx = l.cards.findIndex(c => c.id === card.id);
                if(idx > -1) { l.cards.splice(idx, 1); saveRender(); }
            });

            cardHeadRight.appendChild(completeBtn);
            cardHeadRight.appendChild(deleteBtn);

            cardHead.appendChild(cardHeadLeft);
            cardHead.appendChild(cardHeadRight);
            cardEl.appendChild(cardHead);

            // Priority label badge on the card when priority is set
            if(card.priority){
                const label = document.createElement('div');
                label.className = 'priority-label ' + card.priority;
                label.textContent = (card.priority || '').toUpperCase();
                cardEl.appendChild(label);
            }

            // === Card content (name and editable text) ===
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
            nameEl.addEventListener('keydown', (e)=> {
                if(e.key === 'Enter'){
                    if(e.shiftKey){
                        // Insert a line break to allow multiline editing
                        e.preventDefault();
                        try { document.execCommand('insertLineBreak'); } catch(_) {}
                    } else {
                        e.preventDefault();
                        nameEl.blur();
                    }
                }
            });

            txtWrap.appendChild(nameEl);

            // Due date display (persistent when set)
            if(card.due) {
                const dueRow = document.createElement('div');
                dueRow.className = 'card-due-row';
                
                const dueDateBtn = document.createElement('button');
                dueDateBtn.type = 'button';
                dueDateBtn.className = 'card-date-btn';
                dueDateBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>`;
                dueDateBtn.draggable = false;
                dueDateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openInlineDatePicker(card, dueDateBtn);
                });
                
                const dueText = document.createElement('span');
                dueText.className = 'card-due';
                dueText.innerText = formatDate(card.due);
                
                dueRow.appendChild(dueDateBtn);
                dueRow.appendChild(dueText);
                // Place inside text wrapper to keep layout compact
                txtWrap.appendChild(dueRow);
            }

            cardEl.appendChild(txtWrap);

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
            list.cards.push({ id: genId(), name, due: '', priority: null });
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

// Settings menu close handlers
document.addEventListener('click', (e) => {
    if(!settingsMenu) return;
    if(settingsMenu.classList.contains('hidden')) {
        closeAllPalettes();
        return;
    }
    // Close if clicking outside the menu
    if(!settingsMenu.contains(e.target)) {
        settingsMenu.classList.add('hidden');
        settingsMenu.setAttribute('aria-hidden','true');
        closeAllPalettes();
    }
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

// User profile menu functionality
function setupUserProfile(user) {
    const profileBtn = document.getElementById('user-profile-btn');
    const profileMenu = document.getElementById('user-profile-menu');
    const userInitials = document.getElementById('user-initials');
    const menuUserInitials = document.getElementById('menu-user-initials');
    const userName = document.getElementById('user-name');
    const menuUserEmail = document.getElementById('menu-user-email');
    
    // Extract initials from email
    const email = user.email;
    const namePart = email.split('@')[0];
    const initials = namePart.slice(0, 2).toUpperCase();
    
    // Set user info
    if(userInitials) userInitials.textContent = initials;
    if(menuUserInitials) menuUserInitials.textContent = initials;
    if(userName) userName.textContent = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    if(menuUserEmail) menuUserEmail.textContent = email;
    
    // Toggle menu
    if(profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = profileMenu.classList.contains('hidden');
            profileMenu.classList.toggle('hidden');
        });
    }
    
    // Close menu when clicking outside - use setTimeout to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', (e) => {
            if(profileMenu && !profileMenu.classList.contains('hidden') && 
               !profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
                profileMenu.classList.add('hidden');
            }
        });
    }, 100);
    
    // Settings button
    const settingsItem = document.getElementById('profile-settings');
    if(settingsItem) {
        settingsItem.addEventListener('click', (e) => {
            // Prevent the global document click handler from immediately closing the menu
            e.stopPropagation();
            profileMenu.classList.add('hidden');
            
            // Get elements
            const settingsMenu = document.getElementById('settings-menu');
            const bgColorInput = document.getElementById('bg-color');
            const bgUpload = document.getElementById('bg-upload');
            const listOpacityInput = document.getElementById('list-opacity');
            const listOpacityVal = document.getElementById('list-opacity-val');
            const stockList = document.getElementById('stock-list');
            
            if(!settingsMenu) return;
            
            const board = getActiveBoard();
            if(!board) return;
            
            // Populate settings values
            if(bgColorInput) bgColorInput.value = board.bg || '#f4f7fb';
            if(bgUpload) try{ bgUpload.value = ''; }catch(e){}
            
            // Render stock images
            if(stockList) {
                stockList.innerHTML = '';
                STOCK_IMAGES.forEach(src => {
                    const btn = document.createElement('button');
                    btn.className = 'stock-thumb';
                    btn.style.backgroundImage = `url('${src}')`;
                    btn.addEventListener('click', ()=> {
                        board.bgImage = src;
                        saveRender();
                    });
                    stockList.appendChild(btn);
                });
            }
            
            if(listOpacityInput && typeof board.listOpacity !== 'undefined'){
                listOpacityInput.value = board.listOpacity;
                if(listOpacityVal) listOpacityVal.innerText = Math.round(board.listOpacity * 100) + '%';
            }
            
            // Show settings menu (defer slightly to avoid any race with other click handlers)
            setTimeout(() => {
                settingsMenu.classList.remove('hidden');
                settingsMenu.setAttribute('aria-hidden', 'false');
            }, 0);
        });
    }
    
    // Export data feature
    const exportItem = document.getElementById('profile-export');
    if(exportItem) {
        exportItem.addEventListener('click', () => {
            profileMenu.classList.add('hidden');
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `flowboard-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
        });
    }
    
    // Dark mode toggle feature
    const themeItem = document.getElementById('profile-theme');
    if(themeItem) {
        themeItem.addEventListener('click', () => {
            profileMenu.classList.add('hidden');
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
        });
    }
    
    // Apply saved dark mode preference
    if(localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    
    // Clear board button
    const clearItem = document.getElementById('profile-clear');
    if(clearItem) {
        clearItem.addEventListener('click', async () => {
            profileMenu.classList.add('hidden');
            const confirmed = await showConfirmModal('Clear Entire Board?', 'This will remove all lists and cards. This action cannot be undone.');
            if(confirmed) {
                pushUndoState();
                const board = getActiveBoard();
                board.lists = [];
                saveRender();
            }
        });
    }
    
    // Logout button
    const logoutItem = document.getElementById('profile-logout');
    if(logoutItem) {
        logoutItem.addEventListener('click', async () => {
            profileMenu.classList.add('hidden');
            if(confirm('Are you sure you want to logout?')) {
                try {
                    await signOut();
                } catch(e) {
                    console.error('Logout failed:', e);
                }
            }
        });
    }
}

// Authentication check and initialization
async function initializeApp() {
    try {
        // Check if user is authenticated
        currentUser = await getCurrentUser();
        
        if (!currentUser) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return;
        }
        
        // Setup user profile display
        setupUserProfile(currentUser);
        
        // Load boards from Supabase
        const cloudData = await loadBoards(currentUser.id);
        
        if (cloudData) {
            // Use cloud data
            data = cloudData;
        } else {
            // Check if user has local data to migrate
            const localData = loadData();
            if (localData && localData.boards && localData.boards.length > 0) {
                // Migrate local data to cloud
                data = localData;
                await saveBoards(currentUser.id, data);
                console.log('Local data migrated to cloud');
            } else {
                // Initialize with default board
                data = { boards: [defaultBoard], activeBoardId: defaultBoard.id };
                await saveBoards(currentUser.id, data);
            }
        }
        
        // Ensure data integrity
        if(!Array.isArray(data.boards) || data.boards.length === 0){
            data.boards = [defaultBoard];
        }
        if(!data.activeBoardId || !data.boards.find(b => b.id === data.activeBoardId)){
            const found = data.boards.find(b => b.title === defaultBoard.title);
            data.activeBoardId = (found && found.id) || data.boards[0].id;
        }
        
        // Ensure listOpacity default
        data.boards.forEach(b=>{ if(typeof b.listOpacity === 'undefined') b.listOpacity = 0.4; });
        
        // Setup initial UI and render
        render();
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Failed to load your boards. Please try refreshing the page.');
    }
}

// Start the app
initializeApp();
