package com.acadex.app;

import android.os.Bundle; // Make sure this is imported
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme); // This switches from "Splash" to "White Background"
        super.onCreate(savedInstanceState);
    }
}