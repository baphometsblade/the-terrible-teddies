import React from 'react';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import TeddyCard from '../TeddyCard';

const CollectionArea = ({ collection }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Your Collection</h2>
      <Droppable droppableId="collection">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 gap-2">
            {collection.map((teddy, index) => (
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

export default CollectionArea;