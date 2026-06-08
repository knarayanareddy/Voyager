import { Block } from '../types';

/**
 * Recursively search for a block and its context (parent, index, siblings list) in a block tree.
 */
export const findBlockContext = (
  blocks: Block[],
  uuid: string,
  parent?: Block
): { block: Block; parent: Block | undefined; index: number; siblings: Block[] } | null => {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].uuid === uuid) {
      return {
        block: blocks[i],
        parent,
        index: i,
        siblings: blocks,
      };
    }
    const childResult = findBlockContext(blocks[i].children, uuid, blocks[i]);
    if (childResult) return childResult;
  }
  return null;
};

/**
 * Updates a block in the tree in-place.
 */
export const updateBlockInTree = (blocks: Block[], uuid: string, updates: Partial<Block>): boolean => {
  const context = findBlockContext(blocks, uuid);
  if (!context) return false;
  
  const { block } = context;
  Object.assign(block, updates);
  return true;
};

/**
 * Adds a new block into the tree relative to a target block.
 * If asChild is true, it is added as the first child of the target block.
 * Otherwise, it is added as a sibling immediately following the target block.
 */
export const addBlockToTree = (
  blocks: Block[],
  targetUuid: string,
  newBlock: Block,
  asChild: boolean
): boolean => {
  const context = findBlockContext(blocks, targetUuid);
  if (!context) return false;

  const { block, parent, index, siblings } = context;

  if (asChild) {
    // Add as child
    newBlock.parentUuid = block.uuid;
    block.children.unshift(newBlock);
    block.collapsed = false; // Expand parent so child is visible
  } else {
    // Add as sibling
    newBlock.parentUuid = parent?.uuid;
    siblings.splice(index + 1, 0, newBlock);
  }
  return true;
};

/**
 * Deletes a block from the tree.
 */
export const deleteBlockFromTree = (blocks: Block[], uuid: string): boolean => {
  const context = findBlockContext(blocks, uuid);
  if (!context) return false;

  const { index, siblings } = context;
  siblings.splice(index, 1);
  return true;
};

/**
 * Indents a block (makes it a child of its preceding sibling).
 * Returns true if successful.
 */
export const indentBlockInTree = (blocks: Block[], uuid: string): boolean => {
  const context = findBlockContext(blocks, uuid);
  if (!context) return false;

  const { block, index, siblings } = context;

  // Need a preceding sibling to indent into
  if (index === 0) return false;

  const precedingSibling = siblings[index - 1];

  // Remove from current siblings
  siblings.splice(index, 1);

  // Add to preceding sibling's children
  block.parentUuid = precedingSibling.uuid;
  precedingSibling.children.push(block);
  precedingSibling.collapsed = false; // Make sure it's expanded

  return true;
};

/**
 * Outdents a block (moves it up one level in the hierarchy, placing it after its parent).
 * Returns true if successful.
 */
export const outdentBlockInTree = (blocks: Block[], uuid: string): boolean => {
  const context = findBlockContext(blocks, uuid);
  if (!context) return false;

  const { block, parent, index, siblings } = context;

  // If already at root level, cannot outdent
  if (!parent) return false;

  // Find parent's context to know where to insert the block
  const parentContext = findBlockContext(blocks, parent.uuid);
  if (!parentContext) return false;

  const { parent: grandparent, index: parentIndex, siblings: parentSiblings } = parentContext;

  // Remove from parent's children
  siblings.splice(index, 1);

  // Set new parent UUID (grandparent's UUID or undefined if parent was root)
  block.parentUuid = grandparent?.uuid;

  // Insert as sibling after the parent block
  parentSiblings.splice(parentIndex + 1, 0, block);

  return true;
};

/**
 * Flatten a block tree into a flat array of blocks.
 */
export const flattenBlocks = (blocks: Block[]): Block[] => {
  const flat: Block[] = [];
  const traverse = (b: Block) => {
    flat.push(b);
    b.children.forEach(traverse);
  };
  blocks.forEach(traverse);
  return flat;
};
