#!/bin/bash
# Shabbat guard — exits 1 if it's currently Shabbat in Israel.
# Shabbat = Friday sunset to Saturday sunset (Israel time, UTC+3).
# Conservative window: Friday 16:00 UTC (19:00 IST) to Saturday 18:00 UTC (21:00 IST).
# June sunset in Israel is ~19:45, havdalah ~20:30. This is generous on both ends.

ISRAEL_HOUR=$(TZ=Asia/Jerusalem date +%H)
ISRAEL_DOW=$(TZ=Asia/Jerusalem date +%u)  # 1=Mon, 5=Fri, 6=Sat, 7=Sun

# Friday after 16:00 Israel time (well before candle lighting)
if [ "$ISRAEL_DOW" -eq 5 ] && [ "$ISRAEL_HOUR" -ge 16 ]; then
  echo "Shabbat guard: Friday evening in Israel, skipping."
  exit 1
fi

# All of Saturday until 21:00 Israel time
if [ "$ISRAEL_DOW" -eq 6 ]; then
  if [ "$ISRAEL_HOUR" -lt 21 ]; then
    echo "Shabbat guard: Saturday in Israel, skipping."
    exit 1
  fi
fi

exit 0
