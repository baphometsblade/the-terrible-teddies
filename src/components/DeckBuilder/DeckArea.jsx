import React from 'react';
import { Dr

opable, Draggable } from 'react-beautiful-dnd';
import TeddyCard from '../TeddyCard';

const DeckArea = ({ deck }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Your Deck ({deck.length}/10)</h2>
      <Droppable droppableId="deck">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 gap-2 min-h-[200px] bg-gray-100 p-4 rounded">
            {deck.map((teddy, index) => (
              <Draggable key={teddy.id} draggableId={teddy.id.toString()} index={index}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                    <TeddyCard teddy={teddy} />
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
};

export default DeckArea;