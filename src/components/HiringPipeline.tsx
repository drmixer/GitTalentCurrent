import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const initialData = {
  candidates: {
    'candidate-1': { id: 'candidate-1', content: 'John Doe' },
    'candidate-2': { id: 'candidate-2', content: 'Jane Smith' },
    'candidate-3': { id: 'candidate-3', content: 'Peter Jones' },
  },
  columns: {
    'column-1': {
      id: 'column-1',
      title: 'New',
      candidateIds: ['candidate-1', 'candidate-2', 'candidate-3'],
    },
    'column-2': {
      id: 'column-2',
      title: 'Contacted',
      candidateIds: [],
    },
    'column-3': {
        id: 'column-3',
        title: 'Interviewing',
        candidateIds: [],
    },
    'column-4': {
        id: 'column-4',
        title: 'Offer',
        candidateIds: [],
    },
    'column-5': {
        id: 'column-5',
        title: 'Hired/Rejected',
        candidateIds: [],
    },
  },
  columnOrder: ['column-1', 'column-2', 'column-3', 'column-4', 'column-5'],
};

const HiringPipeline: React.FC = () => {
  const [state, setState] = useState(initialData);

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const start = state.columns[source.droppableId];
    const finish = state.columns[destination.droppableId];

    if (start === finish) {
        const newCandidateIds = Array.from(start.candidateIds);
        newCandidateIds.splice(source.index, 1);
        newCandidateIds.splice(destination.index, 0, draggableId);

        const newColumn = {
          ...start,
          candidateIds: newCandidateIds,
        };

        const newState = {
          ...state,
          columns: {
            ...state.columns,
            [newColumn.id]: newColumn,
          },
        };

        setState(newState);
        return;
    }

    const startCandidateIds = Array.from(start.candidateIds);
    startCandidateIds.splice(source.index, 1);
    const newStart = {
        ...start,
        candidateIds: startCandidateIds,
    };

    const finishCandidateIds = Array.from(finish.candidateIds);
    finishCandidateIds.splice(destination.index, 0, draggableId);
    const newFinish = {
        ...finish,
        candidateIds: finishCandidateIds,
    };

    const newState = {
        ...state,
        columns: {
            ...state.columns,
            [newStart.id]: newStart,
            [newFinish.id]: newFinish,
        },
    };
    setState(newState);

  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex">
      {state.columnOrder.map(columnId => {
        const column = state.columns[columnId];
        const candidates = column.candidateIds.map(
          candidateId => state.candidates[candidateId],
        );

        return (
            <div key={column.id} className="m-2 border rounded w-64">
            <h3 className="p-2 font-bold">{column.title}</h3>
            <Droppable droppableId={column.id}>
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="p-2 min-h-[100px]">
                  {candidates.map((candidate, index) => (
                    <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
                        {(provided) => (
                            <div
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            ref={provided.innerRef}
                            className="p-2 mb-2 border rounded bg-white"
                            >
                            {candidate.content}
                            </div>
                        )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        );
      })}
      </div>
    </DragDropContext>
  );
};

export default HiringPipeline;
