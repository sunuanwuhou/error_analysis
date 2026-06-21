from backend.services.suite_exam_insight import compute_exam_insight

d = compute_exam_insight()
print("summary:", d["summary"])
print("unmapped:", len(d["unmapped_tags"]))
for mod in d["modules"]:
    kp_total = sum(len(c["knowledge_points"]) for c in mod["categories"])
    hit = sum(1 for c in mod["categories"] for kp in c["knowledge_points"] if kp["count"] > 0)
    print(mod["label"], "kp", kp_total, "hit", hit, "q", mod["count"])
