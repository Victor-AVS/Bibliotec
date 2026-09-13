package com.teschi.bibliotec;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            webView.addJavascriptInterface(new WebAppInterface(this), "AndroidHost");
        }
    }

    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void savePdfFile(String base64Pdf, String filename) {
            try {
                if (base64Pdf.contains(",")) {
                    base64Pdf = base64Pdf.split(",")[1];
                }
                byte[] pdfBytes = Base64.decode(base64Pdf, Base64.DEFAULT);

                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File file = new File(downloadsDir, filename);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(pdfBytes);
                fos.flush();
                fos.close();

                Uri fileUri = FileProvider.getUriForFile(mContext, mContext.getPackageName() + ".fileprovider", file);

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(fileUri, "application/pdf");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                mContext.startActivity(intent);

                runOnUiThread(() -> Toast.makeText(mContext, "📄 PDF guardado en Descargas: " + filename, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(mContext, "Error al descargar el PDF: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    android.print.PrintManager printManager = (android.print.PrintManager) getSystemService(Context.PRINT_SERVICE);
                    android.print.PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("Credencial_TESCHI");
                    printManager.print("Credencial_TESCHI", printAdapter, new android.print.PrintAttributes.Builder().build());
                }
            });
        }
    }
}
