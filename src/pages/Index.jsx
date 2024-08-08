import { useState } from 'react';
import { useSupabaseAuth } from '../integrations/supabase/auth';
import { useTasks, useAddTask, useUpdateTask, useDeleteTask } from '../integrations/supabase/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';

const Index = () => {
  const { session, loading, logout } = useSupabaseAuth();
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const addTask = useAddTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Welcome to Task Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Please sign in to access your tasks.</p>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (newTaskTitle.trim()) {
      await addTask.mutateAsync({ title: newTaskTitle, user_id: session.user.id, completed: false });
      setNewTaskTitle('');
    }
  };

  const handleToggleTask = async (task) => {
    await updateTask.mutateAsync({ id: task.id, completed: !task.completed });
  };

  const handleDeleteTask = async (taskId) => {
    await deleteTask.mutateAsync(taskId);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Task Manager</h1>
        <Button onClick={logout} variant="outline">Logout</Button>
      </div>

      <form onSubmit={handleAddTask} className="mb-6">
        <div className="flex gap-2">
          <Input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Enter a new task"
            className="flex-grow"
          />
          <Button type="submit">Add Task</Button>
        </div>
      </form>

      {tasksLoading ? (
        <p>Loading tasks...</p>
      ) : (
        <div className="space-y-4">
          {tasks && tasks.map((task) => (
            <Card key={task.id} className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => handleToggleTask(task)}
                  id={`task-${task.id}`}
                />
                <label
                  htmlFor={`task-${task.id}`}
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                    task.completed ? 'line-through text-gray-500' : ''
                  }`}
                >
                  {task.title}
                </label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Index;
