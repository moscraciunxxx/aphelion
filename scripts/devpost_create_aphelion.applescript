-- Create APHELION on Devpost in a dedicated Safari window.
-- Abort if the window is not software/new (do not touch Horizon/YouCam).
-- Run: osascript scripts/devpost_create_aphelion.applescript

tell application "Safari"
  set tw to missing value
  repeat with w from 1 to (count of windows)
    set b to bounds of window w
    if (item 1 of b) = 40 and (item 2 of b) = 60 then set tw to w
  end repeat
  if tw is missing value then
    make new document with properties {URL:"https://devpost.com/software/new"}
    set bounds of window 1 to {40, 60, 1100, 920}
    delay 2
  else
    set index of window tw to 1
  end if
  if (URL of current tab of window 1) does not contain "software/new" then
    set URL of current tab of window 1 to "https://devpost.com/software/new"
    delay 2
  end if
  if (URL of current tab of window 1) does not contain "software/new" then
    error "window is not software/new: " & (URL of current tab of window 1)
  end if
  activate
end tell

delay 0.3
tell application "System Events"
  tell process "Safari"
    set frontmost to true
    click at {570, 421}
    delay 0.15
    keystroke "a" using command down
    delay 0.08
    keystroke "APHELION"
    delay 0.3
    click at {305, 507}
    delay 4
    click at {273, 576}
  end tell
end tell
