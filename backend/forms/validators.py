"""
Question Validation Utilities
Validates question order, conditional logic, and follow-up question integrity
"""

from typing import List, Dict, Tuple
from django.core.exceptions import ValidationError


def validate_question_order(questions: List[Dict]) -> Tuple[bool, List[str]]:
    """
    Validate that parent questions appear before their follow-up questions.

    Args:
        questions: List of question dicts with id, order_index, is_follow_up, conditional_logic

    Returns:
        Tuple of (is_valid: bool, errors: List[str])
    """
    errors = []
    question_positions = {}  # Map question IDs to their order_index

    # First pass: Build position map
    for question in questions:
        question_positions[str(question.get('id'))] = question.get('order_index', 0)

    # Second pass: Validate follow-up questions
    for question in questions:
        if not question.get('is_follow_up'):
            continue

        conditional_logic = question.get('conditional_logic')
        if not conditional_logic or not conditional_logic.get('enabled'):
            continue

        parent_id = conditional_logic.get('parent_question_id')
        if not parent_id:
            errors.append(
                f"Question '{question.get('question_text', 'Unknown')}' is marked as follow-up "
                f"but has no parent_question_id in conditional_logic"
            )
            continue

        parent_order = question_positions.get(str(parent_id))
        current_order = question.get('order_index', 0)

        if parent_order is None:
            errors.append(
                f"Follow-up question '{question.get('question_text', 'Unknown')}' references "
                f"parent question ID {parent_id} which doesn't exist in this question set"
            )
        elif parent_order >= current_order:
            errors.append(
                f"Follow-up question '{question.get('question_text', 'Unknown')}' (order {current_order}) "
                f"must appear AFTER its parent question (order {parent_order}). "
                f"Parent questions must come first."
            )

    return (len(errors) == 0, errors)


def validate_conditional_logic_integrity(conditional_logic: Dict) -> Tuple[bool, List[str]]:
    """
    Validate conditional logic structure.

    Args:
        conditional_logic: Conditional logic dict

    Returns:
        Tuple of (is_valid: bool, errors: List[str])
    """
    errors = []

    if not conditional_logic:
        return (True, [])

    if not conditional_logic.get('enabled'):
        return (True, [])

    # Check required fields
    if not conditional_logic.get('parent_question_id'):
        errors.append("conditional_logic.parent_question_id is required when enabled=true")

    show_if = conditional_logic.get('show_if')
    if not show_if:
        errors.append("conditional_logic.show_if is required when enabled=true")
    else:
        operator = show_if.get('operator')
        if not operator:
            errors.append("conditional_logic.show_if.operator is required")
        else:
            valid_operators = [
                'equals', 'not_equals', 'contains', 'not_contains',
                'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal',
                'in', 'not_in', 'is_empty', 'is_not_empty', 'between'
            ]
            if operator not in valid_operators:
                errors.append(
                    f"Invalid operator '{operator}'. Must be one of: {', '.join(valid_operators)}"
                )

            # Validate value/values based on operator
            if operator in ['in', 'not_in', 'between']:
                values = show_if.get('values')
                if not values or not isinstance(values, list) or len(values) == 0:
                    errors.append(f"Operator '{operator}' requires a non-empty 'values' array")
                if operator == 'between' and len(values) < 2:
                    errors.append("Operator 'between' requires at least 2 values (min and max)")
            elif operator not in ['is_empty', 'is_not_empty']:
                if 'value' not in show_if or show_if.get('value') is None:
                    errors.append(f"Operator '{operator}' requires a 'value' field")

    return (len(errors) == 0, errors)


def auto_fix_question_order(questions: List[Dict]) -> List[Dict]:
    """
    Automatically reorder questions so parent questions come before their follow-ups.
    Uses topological sorting to resolve dependencies.

    Args:
        questions: List of question dicts

    Returns:
        Reordered list of questions with updated order_index
    """
    from collections import defaultdict, deque

    # Build dependency graph
    dependencies = defaultdict(list)  # child -> [parents]
    dependents = defaultdict(list)    # parent -> [children]
    question_map = {str(q.get('id')): q for q in questions}

    for question in questions:
        q_id = str(question.get('id'))

        if question.get('is_follow_up'):
            conditional_logic = question.get('conditional_logic', {})
            parent_id = conditional_logic.get('parent_question_id')

            if parent_id and str(parent_id) in question_map:
                dependencies[q_id].append(str(parent_id))
                dependents[str(parent_id)].append(q_id)

    # Topological sort using Kahn's algorithm
    in_degree = {str(q.get('id')): len(dependencies.get(str(q.get('id')), [])) for q in questions}
    queue = deque([q_id for q_id in in_degree if in_degree[q_id] == 0])
    sorted_questions = []

    while queue:
        current_id = queue.popleft()
        sorted_questions.append(question_map[current_id])

        for dependent_id in dependents[current_id]:
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                queue.append(dependent_id)

    # Check for cycles
    if len(sorted_questions) != len(questions):
        raise ValidationError(
            "Circular dependency detected in follow-up questions. "
            "Question A cannot depend on Question B if Question B depends on Question A."
        )

    # Update order_index
    for idx, question in enumerate(sorted_questions):
        question['order_index'] = idx

    return sorted_questions


def get_question_depth(question_id: str, questions: List[Dict], visited=None) -> int:
    """
    Calculate the depth of a question in the dependency tree.
    Root questions (no parents) have depth 0.
    Direct follow-ups have depth 1, etc.

    Args:
        question_id: ID of the question
        questions: List of all questions
        visited: Set of visited IDs to detect cycles

    Returns:
        Depth as integer
    """
    if visited is None:
        visited = set()

    if question_id in visited:
        raise ValidationError(f"Circular dependency detected involving question {question_id}")

    visited.add(question_id)

    question_map = {str(q.get('id')): q for q in questions}
    question = question_map.get(str(question_id))

    if not question or not question.get('is_follow_up'):
        return 0

    conditional_logic = question.get('conditional_logic', {})
    parent_id = conditional_logic.get('parent_question_id')

    if not parent_id:
        return 0

    return 1 + get_question_depth(str(parent_id), questions, visited)


def build_question_tree(questions: List[Dict]) -> Dict:
    """
    Build a tree structure showing question dependencies.

    Args:
        questions: List of question dicts

    Returns:
        Dict mapping question IDs to their metadata including children
    """
    tree = {}
    question_map = {str(q.get('id')): q for q in questions}

    for question in questions:
        q_id = str(question.get('id'))
        tree[q_id] = {
            'question': question,
            'children': [],
            'depth': 0,
            'parent_id': None
        }

    # Build parent-child relationships
    for question in questions:
        q_id = str(question.get('id'))

        if question.get('is_follow_up'):
            conditional_logic = question.get('conditional_logic', {})
            parent_id = str(conditional_logic.get('parent_question_id', ''))

            if parent_id in tree:
                tree[parent_id]['children'].append(q_id)
                tree[q_id]['parent_id'] = parent_id

    # Calculate depths
    for q_id in tree:
        try:
            tree[q_id]['depth'] = get_question_depth(q_id, questions)
        except ValidationError:
            tree[q_id]['depth'] = -1  # Indicates cycle

    return tree
