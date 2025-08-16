import React from 'react';
import SandpackTest from '../components/Tests/SandpackTest';

const TestVuePage: React.FC = () => {
  const sampleVueCode = `<template>
  <div class="todo-app">
    <h1>Vue Todo App</h1>
    <div class="input-section">
      <input 
        v-model="newTodo" 
        @keyup.enter="addTodo"
        placeholder="Add a new todo..."
        class="todo-input"
      />
      <button @click="addTodo" :disabled="!newTodo.trim()">Add</button>
    </div>
    
    <ul class="todo-list">
      <li 
        v-for="todo in todos" 
        :key="todo.id"
        :class="{ completed: todo.completed }"
        class="todo-item"
      >
        <input 
          type="checkbox" 
          v-model="todo.completed"
          class="todo-checkbox"
        />
        <span class="todo-text">{{ todo.text }}</span>
        <button @click="removeTodo(todo.id)" class="remove-btn">Remove</button>
      </li>
    </ul>
    
    <div class="stats">
      <p>Total: {{ todos.length }} | Completed: {{ completedCount }}</p>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'TodoApp',
  setup() {
    const newTodo = ref('')
    const todos = ref([])
    let todoId = 0

    const addTodo = () => {
      if (newTodo.value.trim()) {
        todos.value.push({
          id: ++todoId,
          text: newTodo.value.trim(),
          completed: false
        })
        newTodo.value = ''
      }
    }

    const removeTodo = (id) => {
      const index = todos.value.findIndex(todo => todo.id === id)
      if (index > -1) {
        todos.value.splice(index, 1)
      }
    }

    const completedCount = computed(() => {
      return todos.value.filter(todo => todo.completed).length
    })

    return {
      newTodo,
      todos,
      addTodo,
      removeTodo,
      completedCount
    }
  }
}
</script>

<style scoped>
.todo-app {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}

.input-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.todo-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.todo-item.completed .todo-text {
  text-decoration: line-through;
  opacity: 0.6;
}

.remove-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}
</style>`;

  const sampleVueTestCode = `import { mount } from '@vue/test-utils'
import TodoApp from './App.vue'

describe('TodoApp', () => {
  test('renders todo app with title', () => {
    const wrapper = mount(TodoApp)
    expect(wrapper.find('h1').text()).toBe('Vue Todo App')
  })

  test('can add a new todo', async () => {
    const wrapper = mount(TodoApp)
    const input = wrapper.find('.todo-input')
    const button = wrapper.find('button')

    await input.setValue('Test todo')
    await button.trigger('click')

    expect(wrapper.find('.todo-text').text()).toBe('Test todo')
    expect(wrapper.vm.todos).toHaveLength(1)
  })

  test('can toggle todo completion', async () => {
    const wrapper = mount(TodoApp)
    
    // Add a todo first
    await wrapper.find('.todo-input').setValue('Test todo')
    await wrapper.find('button').trigger('click')

    const checkbox = wrapper.find('.todo-checkbox')
    await checkbox.setChecked(true)

    expect(wrapper.find('.todo-item').classes()).toContain('completed')
    expect(wrapper.vm.completedCount).toBe(1)
  })

  test('can remove a todo', async () => {
    const wrapper = mount(TodoApp)
    
    // Add a todo first
    await wrapper.find('.todo-input').setValue('Test todo')
    await wrapper.find('button').trigger('click')

    expect(wrapper.vm.todos).toHaveLength(1)

    await wrapper.find('.remove-btn').trigger('click')
    expect(wrapper.vm.todos).toHaveLength(0)
  })

  test('shows correct todo stats', async () => {
    const wrapper = mount(TodoApp)
    
    // Add two todos
    await wrapper.find('.todo-input').setValue('Todo 1')
    await wrapper.find('button').trigger('click')
    
    await wrapper.find('.todo-input').setValue('Todo 2')
    await wrapper.find('button').trigger('click')

    // Complete one todo
    await wrapper.findAll('.todo-checkbox')[0].setChecked(true)

    const stats = wrapper.find('.stats p').text()
    expect(stats).toBe('Total: 2 | Completed: 1')
  })
})`;

  const handleTestComplete = () => {
    console.log('Vue test completed and submitted!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Vue.js Testing Environment
        </h1>
        <p className="text-gray-600 mb-4">
          Complete the Vue Todo app and make sure all tests pass. This demonstrates Vue 3 component testing with Vue Test Utils.
        </p>
        
        {/* Framework Navigation */}
        <div className="flex space-x-4 mb-8">
          <a 
            href="/test-sandpack" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            React Test
          </a>
          <a 
            href="/test-javascript" 
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
          >
            JavaScript Test
          </a>
          <a 
            href="/test-vue" 
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Vue.js Test
          </a>
          <a 
            href="#" 
            className="px-4 py-2 bg-gray-400 text-white rounded-md cursor-not-allowed"
            title="Angular support coming soon"
          >
            Angular Test (Coming Soon)
          </a>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Vue Todo App Component Test</h2>
          <p className="text-gray-600 mb-6">
            Build a functional Todo app with Vue 3 Composition API. Click "Run Tests" to execute the test suite.
          </p>
          
          <SandpackTest
            framework="vue"
            starterCode={sampleVueCode}
            testCode={sampleVueTestCode}
            assignmentId="test-assignment-vue-123"
            questionId="test-question-vue-456"
            onTestComplete={handleTestComplete}
          />
        </div>
      </div>
    </div>
  );
};

export default TestVuePage;