import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

PSYCOPG_VER = 0

try:
    import psycopg
    from psycopg.rows import dict_row
    PSYCOPG_VER = 3
except Exception:
    try:
        import psycopg2
        import psycopg2.extras
        PSYCOPG_VER = 2
    except Exception:
        pass

app = Flask(__name__)
CORS(app)

DEFAULT_DB_URI = "postgresql://postgres.tovcoonzsecnnpnoekzw:Vesv050423..@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&connect_timeout=5"

def get_connection_string():
    env_uri = os.environ.get("DATABASE_URL", "").strip()
    if not env_uri:
        return DEFAULT_DB_URI
    
    # Auto-fix direct Supabase hostname to IPv4 Pooler if direct IPv6 hostname was configured
    if "db.tovcoonzsecnnpnoekzw.supabase.co" in env_uri:
        env_uri = env_uri.replace("db.tovcoonzsecnnpnoekzw.supabase.co", "aws-0-us-west-2.pooler.supabase.com").replace(":5432", ":6543")
    
    if "sslmode" not in env_uri:
        delim = "&" if "?" in env_uri else "?"
        env_uri += f"{delim}sslmode=require"

    if "connect_timeout" not in env_uri:
        delim = "&" if "?" in env_uri else "?"
        env_uri += f"{delim}connect_timeout=5"
        
    return env_uri

def get_db_connection():
    db_uri = get_connection_string()
    if PSYCOPG_VER == 3:
        return psycopg.connect(db_uri, connect_timeout=5)
    elif PSYCOPG_VER == 2:
        return psycopg2.connect(db_uri, connect_timeout=5)
    else:
        raise RuntimeError("Neither psycopg nor psycopg2 driver could be loaded.")

def get_cursor(conn):
    if PSYCOPG_VER == 3:
        return conn.cursor(row_factory=dict_row)
    else:
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def release_db_connection(conn):
    try:
        if conn:
            conn.close()
    except Exception:
        pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({
        "status": "ok", 
        "message": "Bibliotec backend is online", 
        "driver": f"psycopg_v{PSYCOPG_VER}"
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("SELECT COUNT(*) as total_libros, SUM(stock_disponible) as total_disponibles FROM libro;")
        res = cursor.fetchone()
        return jsonify({
            "success": True,
            "total_libros": res['total_libros'],
            "total_disponibles": res['total_disponibles'] or 0
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/eventos', methods=['GET'])
def get_eventos():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT id_evento, titulo, descripcion, imagen_url, fecha_inicio, fecha_fin
            FROM evento
            WHERE activo = TRUE
            ORDER BY id_evento ASC;
        """)
        eventos = cursor.fetchall()
        return jsonify({"success": True, "eventos": eventos})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("SELECT id_categoria, categoria FROM categoria ORDER BY id_categoria ASC;")
        categorias = cursor.fetchall()
        return jsonify({"success": True, "categorias": categorias})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/libros', methods=['GET'])
def get_libros():
    q = request.args.get('q', '').strip()
    cat_filter = request.args.get('categoria', '').strip()
    limit = request.args.get('limit', 20, type=int)

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        sql = """
            SELECT 
                l.id_libro,
                l.titulo,
                l.sinopsis,
                l.anio,
                l.stock_total,
                l.stock_disponible,
                l.isbn,
                l.puntos_otorgados,
                l.promedio_calificacion,
                l.portada_url,
                c.categoria,
                e.editorial,
                STRING_AGG(CONCAT(a.nombre, ' ', COALESCE(a.a_paterno, '')), ', ') as autor
            FROM libro l
            JOIN categoria c ON l.id_categoria = c.id_categoria
            JOIN editorial e ON l.id_editorial = e.id_editorial
            LEFT JOIN libro_autor la ON l.id_libro = la.id_libro
            LEFT JOIN autor a ON la.id_autor = a.id_autor
            WHERE 1=1
        """
        params = []

        if q:
            sql += " AND (l.titulo ILIKE %s OR a.nombre ILIKE %s OR a.a_paterno ILIKE %s OR l.isbn ILIKE %s)"
            search_param = f"%{q}%"
            params.extend([search_param, search_param, search_param, search_param])

        if cat_filter and cat_filter != 'Todos':
            sql += " AND c.categoria ILIKE %s"
            params.append(f"%{cat_filter}%")

        sql += """
            GROUP BY l.id_libro, c.categoria, e.editorial
            ORDER BY l.id_libro ASC
            LIMIT %s;
        """
        params.append(limit)

        cursor.execute(sql, params)
        libros = cursor.fetchall()
        return jsonify({"success": True, "libros": libros, "count": len(libros)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/libros/<int:id_libro>/resenas', methods=['GET'])
def get_resenas_libro(id_libro):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT 
                r.id_resena,
                r.calificacion,
                r.comentario,
                r.fecha_resena,
                CONCAT(p.nombre, ' ', p.a_paterno) as usuario_nombre
            FROM resena_libro r
            JOIN usuario u ON r.id_usuario = u.id_usuario
            JOIN persona p ON u.id_persona = p.id_persona
            WHERE r.id_libro = %s
            ORDER BY r.fecha_resena DESC;
        """, (id_libro,))
        resenas = cursor.fetchall()
        return jsonify({"success": True, "resenas": resenas, "count": len(resenas)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/wishlist/agregar', methods=['POST'])
def agregar_wishlist():
    data = request.json or {}
    id_usuario = data.get('id_usuario')
    id_libro = data.get('id_libro')

    if not id_usuario or not id_libro:
        return jsonify({"success": False, "mensaje": "Usuario y libro requeridos."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            INSERT INTO lista_deseos (id_usuario, id_libro)
            VALUES (%s, %s)
            ON CONFLICT (id_usuario, id_libro) DO NOTHING;
        """, (id_usuario, id_libro))
        conn.commit()

        return jsonify({
            "success": True,
            "mensaje": "¡Libro agregado a tu Lista de Deseos (Quiero leer)!"
        })
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/wishlist/<int:id_usuario>', methods=['GET'])
def get_wishlist(id_usuario):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT l.id_libro, l.titulo, l.portada_url, c.categoria, ld.fecha_agregado
            FROM lista_deseos ld
            JOIN libro l ON ld.id_libro = l.id_libro
            JOIN categoria c ON l.id_categoria = c.id_categoria
            WHERE ld.id_usuario = %s
            ORDER BY ld.fecha_agregado DESC;
        """, (id_usuario,))
        items = cursor.fetchall()
        return jsonify({"success": True, "wishlist": items, "count": len(items)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/libros/<int:id_libro>/calificar', methods=['POST'])
def calificar_libro(id_libro):
    data = request.json or {}
    calificacion = data.get('calificacion', 5)
    comentario = data.get('comentario', '').strip()
    id_usuario = data.get('id_usuario', 1)

    if not (1 <= calificacion <= 5):
        return jsonify({"success": False, "mensaje": "La calificación debe estar entre 1 y 5 estrellas."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            INSERT INTO resena_libro (id_usuario, id_libro, calificacion, comentario)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id_usuario, id_libro) DO UPDATE SET
                calificacion = EXCLUDED.calificacion,
                comentario = EXCLUDED.comentario,
                fecha_resena = CURRENT_TIMESTAMP;
        """, (id_usuario, id_libro, calificacion, comentario))
        conn.commit()

        cursor.execute("SELECT promedio_calificacion FROM libro WHERE id_libro = %s;", (id_libro,))
        prom = cursor.fetchone()

        return jsonify({
            "success": True,
            "mensaje": "¡Puntuación guardada con éxito!",
            "promedio_calificacion": float(prom['promedio_calificacion'])
        })
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/auth/login', methods=['POST'])
def login_usuario():
    data = request.json or {}
    correo_login = data.get('correo', '').strip().lower()
    contrasena = data.get('contrasena', '').strip()

    if not correo_login or not contrasena:
        return jsonify({"success": False, "mensaje": "Correo y contraseña requeridos."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT 
                p.id_persona, p.nombre, p.a_paterno, p.a_materno, p.correo, p.correo_respaldo, p.telefono, p.foto_url,
                u.id_usuario, u.matricula, u.puntos, u.es_deudor,
                cd.licenciatura as carrera, cd.nss, cd.turno, cd.vigencia_inicio, cd.vigencia_fin
            FROM persona p
            JOIN usuario u ON p.id_persona = u.id_persona
            LEFT JOIN credencial_digital cd ON u.id_usuario = cd.id_usuario
            WHERE (p.correo = %s OR p.correo_respaldo = %s) AND p.contrasena = %s;
        """, (correo_login, correo_login, contrasena))
        user = cursor.fetchone()

        if not user:
            return jsonify({"success": False, "mensaje": "Correo o contraseña incorrectos."}), 401

        v_ini = str(user.get('vigencia_inicio', ''))[:4] if user.get('vigencia_inicio') else '2026'
        v_fin = str(user.get('vigencia_fin', ''))[:4] if user.get('vigencia_fin') else '2029'
        user['vigencia'] = f"{v_ini} - {v_fin}"

        return jsonify({
            "success": True,
            "mensaje": f"¡Bienvenido de nuevo, {user['nombre']}!",
            "usuario": user
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/usuario/foto', methods=['POST'])
def actualizar_foto_perfil():
    data = request.json or {}
    id_persona = data.get('id_persona')
    foto_url = data.get('foto_url')

    if not id_persona or not foto_url:
        return jsonify({"success": False, "mensaje": "id_persona y foto_url son requeridos."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("UPDATE persona SET foto_url = %s WHERE id_persona = %s;", (foto_url, id_persona))
        conn.commit()
        return jsonify({"success": True, "mensaje": "Foto de perfil actualizada correctamente."})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/auth/registro', methods=['POST'])
def registro_usuario():
    data = request.json or {}
    nombre = data.get('nombre', '').strip()
    a_paterno = data.get('a_paterno', '').strip()
    a_materno = data.get('a_materno', '').strip()
    correo = data.get('correo', '').strip().lower()
    correo_respaldo = data.get('correo_respaldo', '').strip().lower() or None
    telefono = data.get('telefono', '').strip()
    contrasena = data.get('contrasena', '').strip()
    matricula = data.get('matricula', '').strip()
    carrera = data.get('carrera', 'Ing. Sistemas Computacionales').strip()
    nss = data.get('nss', '').strip() or None
    rol = data.get('rol', 'usuario').strip().lower()

    if not (correo.endswith('@teschi.edu.mx') or correo.endswith('@tesch.edu.mx')):
        return jsonify({"success": False, "mensaje": "El correo principal debe ser institucional (@teschi.edu.mx)."}), 400

    if len(contrasena) < 8:
        return jsonify({"success": False, "mensaje": "La contraseña debe tener al menos 8 caracteres."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            INSERT INTO persona (nombre, a_paterno, a_materno, correo, correo_respaldo, telefono, contrasena)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id_persona;
        """, (nombre, a_paterno, a_materno, correo, correo_respaldo, telefono, contrasena))
        id_persona = cursor.fetchone()['id_persona']

        if rol == 'administrador':
            cursor.execute("""
                INSERT INTO administrador (id_persona)
                VALUES (%s)
                RETURNING id_admi;
            """, (id_persona,))
            
            cursor.execute("""
                INSERT INTO usuario (id_persona, matricula)
                VALUES (%s, %s)
                RETURNING id_usuario, matricula, puntos;
            """, (id_persona, matricula))
            u_data = cursor.fetchone()
        else:
            cursor.execute("""
                INSERT INTO usuario (id_persona, matricula)
                VALUES (%s, %s)
                RETURNING id_usuario, matricula, puntos;
            """, (id_persona, matricula))
            u_data = cursor.fetchone()

        cursor.execute("""
            INSERT INTO credencial_digital (id_usuario, licenciatura, nss, vigencia_inicio, vigencia_fin, fecha_expedicion)
            VALUES (%s, %s, %s, CURRENT_DATE, CURRENT_DATE + INTERVAL '3 years', CURRENT_TIMESTAMP)
            RETURNING id_credencial, vigencia_inicio, vigencia_fin;
        """, (u_data['id_usuario'], carrera, nss))
        cred_data = cursor.fetchone()

        conn.commit()

        v_inicio = str(cred_data['vigencia_inicio'])[:4] if cred_data.get('vigencia_inicio') else '2026'
        v_fin = str(cred_data['vigencia_fin'])[:4] if cred_data.get('vigencia_fin') else '2029'

        user_payload = {
            "id_persona": id_persona,
            "id_usuario": u_data['id_usuario'],
            "nombre": nombre,
            "a_paterno": a_paterno,
            "a_materno": a_materno,
            "correo": correo,
            "correo_respaldo": correo_respaldo,
            "matricula": matricula,
            "carrera": carrera,
            "nss": nss,
            "foto_url": None,
            "rol": rol,
            "vigencia": f"{v_inicio} - {v_fin}",
            "puntos": u_data['puntos']
        }

        return jsonify({
            "success": True, 
            "mensaje": "Registro completado exitosamente", 
            "usuario": user_payload
        })
    except Exception as e:
        if conn: conn.rollback()
        err_msg = str(e)
        if "duplicate" in err_msg.lower() or "unique" in err_msg.lower() or "already exists" in err_msg.lower():
            return jsonify({"success": False, "mensaje": "La matrícula o correo ya están registrados con anterioridad."}), 400
        return jsonify({"success": False, "mensaje": f"Error al registrar: {err_msg}", "error": err_msg}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/credencial/upload_foto', methods=['POST'])
def upload_foto_credencial():
    data = request.get_json() or {}
    id_persona = data.get('id_persona')
    foto_b64 = data.get('foto_b64')

    if not id_persona or not foto_b64:
        return jsonify({"success": False, "mensaje": "id_persona y foto_b64 son requeridos."}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("UPDATE persona SET foto_url = %s WHERE id_persona = %s;", (foto_b64, id_persona))
        conn.commit()
        return jsonify({"success": True, "mensaje": "Fotografía actualizada exitosamente.", "foto_url": foto_b64})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"success": False, "mensaje": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
@app.route('/api/usuario/<int:id_usuario>/perfil', methods=['GET'])
def get_perfil_usuario(id_usuario):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT 
                p.id_persona, p.nombre, p.a_paterno, p.a_materno, p.correo, p.correo_respaldo, p.telefono, p.foto_url,
                u.id_usuario, u.matricula, u.puntos, u.es_deudor,
                cd.licenciatura as carrera, cd.nss, cd.turno, cd.vigencia_inicio, cd.vigencia_fin
            FROM usuario u
            JOIN persona p ON u.id_persona = p.id_persona
            LEFT JOIN credencial_digital cd ON u.id_usuario = cd.id_usuario
            WHERE u.id_usuario = %s;
        """, (id_usuario,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"success": False, "mensaje": "Usuario no encontrado"}), 404

        v_ini = str(user.get('vigencia_inicio', ''))[:4] if user.get('vigencia_inicio') else '2026'
        v_fin = str(user.get('vigencia_fin', ''))[:4] if user.get('vigencia_fin') else '2029'
        user['vigencia'] = f"{v_ini} - {v_fin}"

        return jsonify({"success": True, "usuario": user})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

@app.route('/api/usuario/<int:id_usuario>/prestamos', methods=['GET'])
def get_prestamos_usuario(id_usuario):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = get_cursor(conn)
        cursor.execute("""
            SELECT p.id_prestamo, p.fecha_prestamo, p.fecha_devolucion_esperada, p.fecha_devolucion_real, p.estatus,
                   l.titulo, l.portada_url
            FROM prestamo p
            JOIN libro l ON p.id_libro = l.id_libro
            WHERE p.id_usuario = %s
            ORDER BY p.fecha_prestamo DESC;
        """, (id_usuario,))
        rows = cursor.fetchall()

        pendientes = []
        historial = []
        es_deudor = False

        for pr in rows:
            item = {
                "id_prestamo": pr['id_prestamo'],
                "titulo": pr['titulo'],
                "portada_url": pr.get('portada_url') or '',
                "fecha_prestamo": str(pr['fecha_prestamo'])[:10] if pr.get('fecha_prestamo') else '',
                "fecha_devolucion_esperada": str(pr.get('fecha_devolucion_esperada', ''))[:10],
                "fecha_devolucion_real": str(pr.get('fecha_devolucion_real', ''))[:10]
            }
            if pr.get('estatus') == 'entregado' or pr.get('fecha_devolucion_real'):
                historial.append(item)
            else:
                pendientes.append(item)
                if pr.get('estatus') == 'vencido':
                    es_deudor = True

        return jsonify({
            "success": True,
            "es_deudor": es_deudor,
            "pendientes": pendientes,
            "historial": historial,
            "total_historial": len(historial)
        })
    except Exception as e:
        return jsonify({
            "success": True,
            "es_deudor": False,
            "pendientes": [],
            "historial": [],
            "total_historial": 0
        })
    finally:
        if cursor:
            try: cursor.close()
            except Exception: pass
        release_db_connection(conn)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

