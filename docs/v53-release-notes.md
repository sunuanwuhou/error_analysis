# Ashore V5.3 release notes

## This build includes both V5.2 and V5.3 goals

### V5.2
- Root workbench keeps the modular shell introduced in 5.1.
- Legacy JS bundle loading is replaced with sequential loading of split source modules from `xingce_v3/modules/main/*` plus knowledge/data modules.
- Layout shell remains independent from `xingce_v3.html`.

### V5.3
- Mobile top bar and bottom quick actions are added.
- Sidebar remains drawer-style on mobile and closes when main area is tapped.
- Main workspace gets extra spacing for mobile safe areas.
- Common actions are promoted for phone usage: notes, errors, add, review, cloud save.
- The package still keeps registration disabled.
