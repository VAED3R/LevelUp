"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './GoalForm.module.css';

export default function GoalForm({ onGoalAdded, onCancel, editingGoal = null }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: editingGoal?.title || '',
    description: editingGoal?.description || '',
    deadline: editingGoal?.deadline ? editingGoal.deadline.split('T')[0] : '',
    priority: editingGoal?.priority || 'medium',
    category: editingGoal?.category || 'academic'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Goal title is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Goal description is required');
      return false;
    }
    if (!formData.deadline) {
      setError('Deadline is required');
      return false;
    }
    if (new Date(formData.deadline) <= new Date()) {
      setError('Deadline must be in the future');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const goalData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        deadline: new Date(formData.deadline).toISOString(),
        priority: formData.priority,
        category: formData.category,
        progress: editingGoal?.progress || 0,
        createdAt: editingGoal?.createdAt || new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      const response = await fetch('/api/learning-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user.uid,
          action: editingGoal ? 'updateGoal' : 'addGoal',
          data: editingGoal ? {
            goalId: editingGoal.id,
            updates: goalData
          } : goalData
        }),
      });

      const result = await response.json();

      if (result.error) {
        setError(result.error);
        return;
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        deadline: '',
        priority: 'medium',
        category: 'academic'
      });

      // Notify parent component
      if (onGoalAdded) {
        onGoalAdded(result.profile);
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      setError('Failed to save goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#ff9800';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'academic': return '📚';
      case 'skill': return '🎯';
      case 'personal': return '🌟';
      case 'career': return '💼';
      default: return '📚';
    }
  };

  return (
    <div className={styles.formOverlay}>
      <div className={styles.formContainer}>
        <div className={styles.formHeader}>
          <h2>{editingGoal ? 'Edit Learning Goal' : 'Add New Learning Goal'}</h2>
          <button 
            className={styles.closeButton}
            onClick={onCancel}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.goalForm}>
          <div className={styles.formGroup}>
            <label htmlFor="title" className={styles.label}>
              Goal Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="e.g., Master Linear Algebra"
              maxLength={100}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description" className={styles.label}>
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className={styles.textarea}
              placeholder="Describe what you want to achieve and how you plan to do it..."
              rows={4}
              maxLength={500}
              disabled={loading}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="deadline" className={styles.label}>
                Deadline *
              </label>
              <input
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleInputChange}
                className={styles.input}
                min={new Date().toISOString().split('T')[0]}
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="priority" className={styles.label}>
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className={styles.select}
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category" className={styles.label}>
              Category
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={styles.select}
              disabled={loading}
            >
              <option value="academic">📚 Academic</option>
              <option value="skill">🎯 Skill Development</option>
              <option value="personal">🌟 Personal Growth</option>
              <option value="career">💼 Career</option>
            </select>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className={styles.loadingSpinner}></div>
                  Saving...
                </>
              ) : (
                editingGoal ? 'Update Goal' : 'Add Goal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 