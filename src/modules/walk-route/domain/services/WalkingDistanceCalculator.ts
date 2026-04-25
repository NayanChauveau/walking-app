const WALKING_SPEED_METERS_PER_MINUTE = 80;

type Input = {
  targetDurationMinutes: number;
};

export function calculateTargetWalkingDistanceMeters({
  targetDurationMinutes,
}: Input): number {
  return targetDurationMinutes * WALKING_SPEED_METERS_PER_MINUTE;
}
