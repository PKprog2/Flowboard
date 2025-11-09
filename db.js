import { supabase } from './supabase.js';

// Get current user
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}

// Save boards to database
export async function saveBoards(userId, boardsData) {
  try {
    // Check if user has existing boards
    const { data: existing, error: fetchError } = await supabase
      .from('boards')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw fetchError;
    }
    
    const boardData = {
      user_id: userId,
      board_data: boardsData,
      updated_at: new Date().toISOString()
    };
    
    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('boards')
        .update(boardData)
        .eq('user_id', userId);
      
      if (error) throw error;
    } else {
      // Insert new
      const { error } = await supabase
        .from('boards')
        .insert([boardData]);
      
      if (error) throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error saving boards:', error);
    throw error;
  }
}

// Load boards from database
export async function loadBoards(userId) {
  try {
    const { data, error } = await supabase
      .from('boards')
      .select('board_data')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No boards found, return null
        return null;
      }
      throw error;
    }
    
    return data.board_data;
  } catch (error) {
    console.error('Error loading boards:', error);
    throw error;
  }
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
  window.location.href = 'index.html';
}
