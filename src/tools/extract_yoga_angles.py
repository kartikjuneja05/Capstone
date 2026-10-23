#!/usr/bin/env python3
"""Estimate reference-image angles; these are measurements, not ideal targets."""
import argparse
import csv
import json
import math
from pathlib import Path
import sys
import urllib.request

MODEL_URL = ('https://storage.googleapis.com/mediapipe-models/pose_landmarker/'
             'pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task')
JOINTS = {
    'left_shoulder': (23, 11, 13), 'right_shoulder': (24, 12, 14),
    'left_elbow': (11, 13, 15), 'right_elbow': (12, 14, 16),
    'left_hip': (11, 23, 25), 'right_hip': (12, 24, 26),
    'left_knee': (23, 25, 27), 'right_knee': (24, 26, 28),
    'left_ankle': (25, 27, 31), 'right_ankle': (26, 28, 32),
}


def angle(a, b, c):
    """Unsigned interior angle ABC, 0..180 degrees; straight = 180."""
    u = [x-y for x, y in zip(a, b)]
    v = [x-y for x, y in zip(c, b)]
    denominator = math.hypot(*u) * math.hypot(*v)
    if not math.isfinite(denominator) or denominator < 1e-10:
        return None
    cosine = sum(x*y for x, y in zip(u, v)) / denominator
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


def measurements(landmarks, world, width, height, threshold):
    output = {}
    for name, ids in JOINTS.items():
        points = [landmarks[i] for i in ids]
        visibility = min(p.visibility if p.visibility is not None else 0 for p in points)
        presence = min(p.presence if p.presence is not None else 0 for p in points)
        reasons = []
        if visibility < threshold or presence < threshold:
            reasons.append('low_landmark_confidence')
        if any(not (0 <= p.x <= 1 and 0 <= p.y <= 1) for p in points):
            reasons.append('landmark_outside_image')
        # x and y must use pixels: normalized axes have different scales.
        a2 = angle(*[(p.x*width, p.y*height) for p in points])
        a3 = angle(*[(world[i].x, world[i].y, world[i].z) for i in ids]) if world else None
        if a2 is None or (world and a3 is None):
            reasons.append('degenerate_geometry')
        output[name] = {
            'landmark_ids_ABC': list(ids),
            'angle_2d_deg': round(a2, 2) if a2 is not None and not reasons else None,
            'angle_3d_estimate_deg': round(a3, 2) if a3 is not None and not reasons else None,
            'min_visibility': round(visibility, 4), 'min_presence': round(presence, 4),
            'status': 'review_required' if reasons else 'usable_estimate',
            'reasons': reasons,
        }
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs', nargs='*', type=Path, help='Images or folders (searched recursively)')
    parser.add_argument('--output', type=Path, default=Path('angle_results'))
    parser.add_argument('--model', type=Path, default=Path('models/pose_landmarker_heavy.task'))
    parser.add_argument('--download-model', action='store_true', help='Download Google model if missing')
    parser.add_argument('--confidence', type=float, default=0.65)
    args = parser.parse_args()
    if not 0 <= args.confidence <= 1:
        parser.error('--confidence must be between 0 and 1')
    if args.download_model and not args.model.exists():
        args.model.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.model.with_suffix('.download')
        try:
            urllib.request.urlretrieve(MODEL_URL, temporary)
            temporary.replace(args.model)
        finally:
            temporary.unlink(missing_ok=True)
    if not args.inputs:
        if args.download_model:
            return 0
        parser.error('Provide an image or folder')
    if not args.model.is_file():
        parser.error('Model missing; use --download-model or --model PATH')
    try:
        import mediapipe as mp
        import numpy as np
        from PIL import Image, ImageDraw, ImageOps
    except ImportError as exc:
        parser.exit(2, f'Missing dependency: {exc}. Install src/tools/requirements-angles.txt\n')
    extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
    files = set()
    for path in args.inputs:
        if not path.exists():
            parser.error(f'Input does not exist: {path}')
        candidates = path.rglob('*') if path.is_dir() else [path]
        files.update(p.resolve() for p in candidates if p.is_file() and p.suffix.lower() in extensions)
    if not files:
        parser.error('No supported images found')
    args.output.mkdir(parents=True, exist_ok=True)
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(args.model)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_poses=2, min_pose_detection_confidence=0.5, min_pose_presence_confidence=0.5)
    records, rows = [], []
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for index, path in enumerate(sorted(files), 1):
            record = {'image': str(path), 'pose_label': path.stem, 'status': 'error', 'angles': {}}
            try:
                with Image.open(path) as source:
                    image = ImageOps.exif_transpose(source).convert('RGB')
                width, height = image.size
                result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,
                                                  data=np.ascontiguousarray(image)))
                record['image_size'] = [width, height]
                count = len(result.pose_landmarks)
                if count != 1:
                    record['status'] = 'no_pose' if count == 0 else 'multiple_people_review_required'
                else:
                    landmarks = result.pose_landmarks[0]
                    world = result.pose_world_landmarks[0] if result.pose_world_landmarks else None
                    values = measurements(landmarks, world, width, height, args.confidence)
                    record.update(status='measured', angles=values)
                    record['landmarks'] = [dict(x=p.x, y=p.y, z=p.z,
                                               visibility=p.visibility, presence=p.presence) for p in landmarks]
                    draw = ImageDraw.Draw(image)
                    for name, value in values.items():
                        ids = JOINTS[name]
                        pts = [(landmarks[i].x*width, landmarks[i].y*height) for i in ids]
                        color = '#23bd65' if value['status'] == 'usable_estimate' else '#ff7526'
                        draw.line(pts, fill=color, width=3)
                        x, y = pts[1]
                        draw.ellipse((x-4, y-4, x+4, y+4), fill=color)
                        label = str(value['angle_2d_deg']) if value['angle_2d_deg'] is not None else 'REVIEW'
                        rows.append({'image': str(path), 'pose_label': path.stem, 'joint': name,
                                     **{k: v for k, v in value.items() if k not in ('landmark_ids_ABC', 'reasons')},
                                     'reasons': ';'.join(value['reasons'])})
                    # A panel avoids overlapping joint labels on the skeleton.
                    panel_width = 390
                    canvas = Image.new('RGB', (width+panel_width, max(height, 300)), 'white')
                    canvas.paste(image, (0, 0))
                    panel = ImageDraw.Draw(canvas)
                    panel.text((width+10, 10), '2D interior angles (degrees)', fill='black')
                    for row_index, (name, value) in enumerate(values.items()):
                        val = value['angle_2d_deg']
                        panel.text((width+10, 35+row_index*24), f'{name}: {val if val is not None else "REVIEW"}', fill='black')
                    annotated = args.output / f'{index:04d}_{path.stem}_annotated.png'
                    canvas.save(annotated)
                    record['annotated_image'] = str(annotated.resolve())
            except Exception as exc:
                record['error'] = f'{type(exc).__name__}: {exc}'
            records.append(record)
            print(f'{path.name}: {record["status"]}')
    payload = {'schema_version': 1, 'angle_convention': 'unsigned interior ABC, vertex B, straight=180 degrees',
               'warning': 'Image measurements are not ideal targets. 2D depends on view; 3D is inferred, not ground truth. Confidence is not angular accuracy.',
               'confidence_threshold': args.confidence, 'joint_definitions': JOINTS, 'images': records}
    (args.output / 'angles.json').write_text(json.dumps(payload, indent=2, allow_nan=False)+'\n')
    fields = ['image', 'pose_label', 'joint', 'angle_2d_deg', 'angle_3d_estimate_deg',
              'min_visibility', 'min_presence', 'status', 'reasons']
    with (args.output / 'angles.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    return 1 if any(r['status'] != 'measured' for r in records) else 0


if __name__ == '__main__':
    sys.exit(main())
