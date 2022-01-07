import { bind, shareLatest, Subscribe } from '@react-rxjs/core';
import { combineKeys, createSignal, mergeWithKey, partitionByKey } from '@react-rxjs/utils';
import React, { useState } from 'react';
import { map, scan, startWith, takeWhile } from 'rxjs';
import './App.css';

const [newTodo$, onNewTodo] = createSignal<string>();
const [editTodo$, onEditTodo] = createSignal<{id: number, text: string}>();
const [toggleTodo$, onToggleTodo] = createSignal<number>();
const [deleteTodo$, onDeleteTodo] = createSignal<number>();

const todoAction$ = mergeWithKey({
  add: newTodo$.pipe(map((text, id) => ({id: id, text}))),
  edit: editTodo$,
  toggle: toggleTodo$.pipe(map((id) => ({id}))),
  delete: deleteTodo$.pipe(map((id) => ({id})))
})

type Todo = {id: number, text: string, done: boolean};

const [todosById, keys$] = partitionByKey(
  todoAction$,
  event => event.payload.id,
  (event$, id) => 
    event$.pipe(
      takeWhile((event) => (event.type !== 'delete')),
      scan(
        (state, action) => {
          switch(action.type) {
            case 'add':
            case 'edit':
              return {...state, text: action.payload.text};
            case 'toggle':
              return {...state, done: !state.done};
            default:
              return state
          }
        },
        {id, text: "", done: false} as Todo
      )
    )
  
)

const todosMap$ = combineKeys(keys$, todosById);

const todosList$ = todosMap$.pipe(
  map(x => [...x.values()]),
  shareLatest()
)

enum FilterType {
  All = 'all',
  Done = 'done',
  Pending = 'pending'
}

const [selectedFilter$, onSelectFilter] = createSignal<FilterType | string>();

const [useCurrentFilter, currentFilter$] = bind(
  selectedFilter$.pipe(startWith(FilterType.All))
);



const [useTodos, todos$] = bind(keys$);
const [useTodo, todo$] = bind((id: number) => todosById(id))

const TodoListFilter = () => {
  const filter = useCurrentFilter();

  const updateFilter = ({target}: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectFilter(target.value);
  }

  return (
    <>
      Filter:
      <select value={filter} onChange={updateFilter}>
        <option value={FilterType.All}>All</option>
        <option value={FilterType.Pending}>Uncomplete</option>
        <option value={FilterType.Done}>Complete</option>
      </select>
    </>
  )
}

type Stats = {
  nTotal: 0, nCompleted: 0, nUncompleted: 0, percentCompleted: 0
}

const [useTodoStats, stats$] = bind(
  todosList$.pipe(
    map((todoList) => {
      const nTotal = todoList.length;
      const nCompleted = todoList.filter((item) => item.done).length;
      const nUncompleted = nTotal - nCompleted;
      const percentCompleted = nTotal === 0 ? 0 : Math.round((nCompleted / nTotal) * 100);
      return {
        nTotal,
        nCompleted,
        nUncompleted,
        percentCompleted
      }
    })
  ),
  {nTotal: 0, nCompleted: 0, nUncompleted: 0, percentCompleted: 0} as Stats 
)

const TodoListStats = () => {
  const {nTotal, nUncompleted, nCompleted, percentCompleted} = useTodoStats();

  return (
    <ul>
      <li>Total Items: {nTotal}</li>
      <li>Items Completed: {nCompleted}</li>
      <li>Items not Completed {nUncompleted}</li>
      <li>Percent Completed {percentCompleted} %</li>
    </ul>
  )
}

const TodoItemCreator = () => {
  const [inputValue, setInputValue] = useState<string>('');

  const addItem = () => {
    onNewTodo(inputValue);
    setInputValue('');
  }

  const onChange  = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  }

  return (
    <div>
      <input type="text" value={inputValue} onChange={onChange} />
      <button onClick={addItem}>Add</button>
    </div>
  )
}

const TodoItem: React.FC<{id: number}> = ({id}) => {
  const item = useTodo(id);
  const currentFilter = useCurrentFilter();

  return !(
    currentFilter === FilterType.All ||
    (currentFilter === FilterType.Done && item.done) ||
    (currentFilter === FilterType.Pending && !item.done) 
  ) ? null : (
    <div>
      <input 
        type="text" 
        value={item.text} 
        onChange={({target}) => {
          onEditTodo({id: item.id, text: target.value})
        }}
      />
      <input 
        type="checkbox"
        checked={item.done}
        onChange={() => {
          onToggleTodo(item.id)
        }}
      />
      <button
        onClick={() => {
          onDeleteTodo(item.id)
        }}
      >
        X
      </button>
    </div>
  )
}

const TodoList = () => {
  const todoList = useTodos();
  console.log(todoList)
  return (
    <>
      <TodoListStats/>
      <TodoListFilter/>
      <TodoItemCreator/>

      {
        todoList.map((id) => {
          <TodoItem key={id} id={id}/>
        })
      }
    </>
  )
}
function App() {
  return (
    <div className="App">
      <Subscribe>
        <React.Suspense fallback={<p>Wait</p>}>
          <TodoList/>
        </React.Suspense>
      </Subscribe>
    </div>
  );
}

export default App;
