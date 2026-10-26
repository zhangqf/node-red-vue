package com.zy.switchmachine;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "StationFile")
public class StationFilePlugin extends Plugin {
    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");
        String dataBase64 = call.getString("dataBase64");
        if (fileName == null || mimeType == null || dataBase64 == null) {
            call.reject("Missing filename, MIME type, or file data");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        Uri uri = result.getData().getData();
        String dataBase64 = call.getString("dataBase64");
        if (uri == null || dataBase64 == null) {
            call.reject("Unable to access the selected save location");
            return;
        }

        try (OutputStream output = getContext().getContentResolver().openOutputStream(uri)) {
            if (output == null) {
                call.reject("Unable to open the selected save location");
                return;
            }
            output.write(Base64.decode(dataBase64, Base64.DEFAULT));
            call.resolve(new JSObject().put("cancelled", false));
        } catch (IOException | IllegalArgumentException exception) {
            call.reject("Failed to save the template", exception);
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
                "text/csv"
            }
        );
        startActivityForResult(call, intent, "openFileResult");
    }

    @ActivityCallback
    private void openFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("The selected file could not be accessed");
            return;
        }

        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) {
                call.reject("Unable to read the selected file");
                return;
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int bytesRead;
            while ((bytesRead = input.read(chunk)) != -1) {
                buffer.write(chunk, 0, bytesRead);
            }

            JSObject response = new JSObject();
            response.put("cancelled", false);
            response.put("fileName", getFileName(uri));
            response.put("dataBase64", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP));
            call.resolve(response);
        } catch (IOException exception) {
            call.reject("Failed to read the selected file", exception);
        }
    }

    private String getFileName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String name = cursor.getString(nameIndex);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        }
        return "import.xlsx";
    }
}
