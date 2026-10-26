package com.zy.switchmachine;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(StationFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
