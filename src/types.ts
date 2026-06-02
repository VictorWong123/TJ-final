/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BodyPart {
  id: string;
  name: string;
  description: string;
  position: [number, number, number]; // 3D coordinates
}
