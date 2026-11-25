import { Quaternion, Vector3 } from 'three';

/**
 * Waar jouw kaarten nu in je hand zitten (wereldpositie en -draaiing), per kaart-id.
 * Person schrijft dit elk frame; TrickCards laat een gespeelde kaart van daaruit naar tafel gaan,
 * zodat je hem echt uit je waaier ziet komen.
 */
export const handOrigin = new Map<string, { pos: Vector3; quat: Quaternion }>();
