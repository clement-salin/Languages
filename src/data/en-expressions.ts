/** Dépôt des expressions anglaises. */

import { cleanExpression, expressionId, type Expression } from '../domain/en/expression';
import { collectionRepository } from './collection';

export const enExpressions = collectionRepository<Expression>('enExpressions');

export interface NewExpression {
  text: string;
  meaning: string;
  example?: string;
}

/** Ajoute une expression ; `false` si elle existe déjà (rien n'est écrasé). */
export async function addExpression(input: NewExpression): Promise<boolean> {
  const id = expressionId(input.text);
  if (!id || (await enExpressions.get(id))) return false;
  const now = new Date().toISOString();
  await enExpressions.put({
    id,
    text: cleanExpression(input.text),
    meaning: input.meaning,
    example: input.example ?? '',
    notes: '',
    addedAt: now,
    updatedAt: now,
  });
  return true;
}

/** Le texte de l'expression ne change pas : il fait l'identifiant. */
export async function updateExpression(
  id: string,
  patch: Partial<Pick<Expression, 'meaning' | 'example' | 'notes'>>,
): Promise<void> {
  const current = await enExpressions.get(id);
  if (!current) return;
  await enExpressions.put({ ...current, ...patch, updatedAt: new Date().toISOString() });
}
