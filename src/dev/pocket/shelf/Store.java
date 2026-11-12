package dev.pocket.shelf;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;

final class Store {
  private static JSONArray tasks;

  static SharedPreferences prefs(Context c) {
    return c.getSharedPreferences("shelf", Context.MODE_PRIVATE);
  }

  static JSONObject json(Object... pairs) {
    JSONObject o = new JSONObject();
    try {
      for (int i = 0; i < pairs.length; i += 2) o.put((String) pairs[i], pairs[i + 1]);
    } catch (JSONException e) {
      throw new IllegalArgumentException(e);
    }
    return o;
  }

  static synchronized JSONArray tasks(Context c) {
    if (tasks == null) {
      try {
        tasks = new JSONArray(prefs(c).getString("tasks", "[]"));
        for (int i = 0; i < tasks.length(); i++) {
          JSONObject t = tasks.getJSONObject(i);
          if (!t.optString("status").matches("done|error|paused")) {
            t.put("status", "paused");
            t.put("message", "下载已暂停，点击继续");
          }
        }
      } catch (JSONException e) {
        tasks = new JSONArray();
      }
    }
    return tasks;
  }

  static synchronized JSONObject find(Context c, String id) {
    JSONArray a = tasks(c);
    for (int i = 0; i < a.length(); i++) {
      JSONObject t = a.optJSONObject(i);
      if (t != null && t.optString("id").equals(id)) return t;
    }
    return null;
  }

  static synchronized void save(Context c) {
    prefs(c).edit().putString("tasks", tasks(c).toString()).apply();
  }

  static synchronized void update(Context c, JSONObject t, Object... pairs) {
    try {
      for (int i = 0; i < pairs.length; i += 2) t.put((String) pairs[i], pairs[i + 1]);
      save(c);
    } catch (JSONException e) {
      throw new IllegalArgumentException(e);
    }
  }

  static synchronized String snapshot(Context c) {
    return json("root", prefs(c).getString("root", ""), "tasks", tasks(c)).toString();
  }
}
