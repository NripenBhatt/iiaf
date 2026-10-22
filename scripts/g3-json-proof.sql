-- Isolated offline reference only. Run in a disposable local cluster, never as a migration.
CREATE OR REPLACE FUNCTION pg_temp.iiaf_json_proof(v jsonb) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE kind text := jsonb_typeof(v); result text; item record; token text;
  sign text; digits text; fraction text; exponent bigint; parts text[];
BEGIN
  CASE kind
    WHEN 'null' THEN RETURN 'n;';
    WHEN 'boolean' THEN RETURN CASE WHEN v::text='true' THEN 't;' ELSE 'f;' END;
    WHEN 'string' THEN token := v #>> '{}'; RETURN 's'||octet_length(token)||':'||token;
    WHEN 'number' THEN
      token := v::text;
      parts := regexp_match(token, '^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$');
      IF parts IS NULL THEN RAISE EXCEPTION 'Unsupported numeric token'; END IF;
      sign := parts[1]; fraction := coalesce(parts[3],'');
      digits := regexp_replace(parts[2]||fraction,'^0+','');
      IF digits='' THEN RETURN 'd0e0;'; END IF;
      exponent := coalesce(parts[4],'0')::bigint - length(fraction);
      WHILE right(digits,1)='0' LOOP digits:=left(digits,length(digits)-1); exponent:=exponent+1; END LOOP;
      RETURN 'd'||sign||digits||'e'||exponent||';';
    WHEN 'array' THEN
      result := 'a'||jsonb_array_length(v)||':';
      FOR item IN SELECT value FROM jsonb_array_elements(v) WITH ORDINALITY ORDER BY ordinality LOOP result := result || pg_temp.iiaf_json_proof(item.value); END LOOP;
      RETURN result;
    WHEN 'object' THEN
      result := 'o'||(SELECT count(*) FROM jsonb_each(v))||':';
      FOR item IN SELECT key,value FROM jsonb_each(v) ORDER BY convert_to(key,'UTF8') LOOP
        result := result || 's'||octet_length(item.key)||':'||item.key || pg_temp.iiaf_json_proof(item.value);
      END LOOP;
      RETURN result;
    ELSE RAISE EXCEPTION 'Unsupported JSON kind';
  END CASE;
END $$;