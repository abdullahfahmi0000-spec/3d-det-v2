# avatars

People in the twin.

- `create-avatar-kit.ts`: the procedural seated person built at every occupied desk, and
  behind each office's reception desk.
- `create-character.ts`: an animated character from a GLB (a Mixamo rig with its clips), one
  copy of the skeleton and a mixer per person, clothes tinted per person.
- `create-seated-people.ts`: a character typing in every occupied chair, in place of the
  procedural person, its hips set over the seat.
- `create-process-avatar.ts`: the process avatar (AVT-01), who follows the order from desk
  to desk along the walking network: Walk, then Talk at the desk. It walks empty-handed and
  carries the order, as a folder in its right hand, only when told to (`setCarrying`: on the
  last leg, to the lorry). It is a `Walker`, so the doors on its way open for it.

The models are converted by `scripts/blender/build_character.py`.
